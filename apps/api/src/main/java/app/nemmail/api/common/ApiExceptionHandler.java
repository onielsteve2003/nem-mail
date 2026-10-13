package app.nemmail.api.common;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Turns every exception into the error envelope. Spring MVC's own exceptions keep their status;
 * anything unexpected is logged and answered with a generic 500, never a stack trace.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  /** One invalid field, for the form to show next to it. */
  public record FieldProblem(String field, String message) {}

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ApiErrorResponse> handleApi(ApiException ex) {
    return respond(ex.getCode(), ex.getMessage(), ex.getDetails());
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex) {
    log.error("Unhandled exception", ex);
    return respond(ErrorCode.INTERNAL, "Something went wrong on our side.", null);
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    List<FieldProblem> problems =
        ex.getBindingResult().getFieldErrors().stream()
            .map(error -> new FieldProblem(error.getField(), error.getDefaultMessage()))
            .toList();
    return validationFailed(problems);
  }

  @Override
  protected ResponseEntity<Object> handleHandlerMethodValidationException(
      HandlerMethodValidationException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    List<FieldProblem> problems =
        ex.getParameterValidationResults().stream()
            .flatMap(
                result ->
                    result.getResolvableErrors().stream()
                        .map(
                            error ->
                                new FieldProblem(
                                    fieldOf(result, error), error.getDefaultMessage())))
            .toList();
    return validationFailed(problems);
  }

  /** Every other Spring MVC exception: keep its status, swap the body for the envelope. */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    ErrorCode code = ErrorCode.of(status);
    String message = status.is5xxServerError() ? "Something went wrong on our side." : reason(ex);
    if (status.is5xxServerError()) {
      log.error("Request failed", ex);
    }
    return ResponseEntity.status(status)
        .headers(headers)
        .body(ApiErrorResponse.of(code, message, null));
  }

  private static ResponseEntity<Object> validationFailed(List<FieldProblem> problems) {
    return ResponseEntity.status(ErrorCode.VALIDATION_FAILED.status())
        .body(
            ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED, "Some fields are not valid.", problems));
  }

  private static ResponseEntity<ApiErrorResponse> respond(
      ErrorCode code, String message, Object details) {
    return ResponseEntity.status(code.status()).body(ApiErrorResponse.of(code, message, details));
  }

  private static String fieldOf(ParameterValidationResult result, MessageSourceResolvable error) {
    return error instanceof FieldError field
        ? field.getField()
        : result.getMethodParameter().getParameterName();
  }

  /** A short, safe sentence for client errors; Spring's reasons name no internals. */
  private static String reason(Exception ex) {
    return switch (ex) {
      case NoResourceFoundException _ -> "Not found.";
      case HttpMessageNotReadableException _ -> "The request body could not be read.";
      case HttpRequestMethodNotSupportedException e ->
          "Method " + e.getMethod() + " is not allowed here.";
      case HttpMediaTypeNotSupportedException _ -> "Send the body as application/json.";
      default -> "The request is not valid.";
    };
  }
}
