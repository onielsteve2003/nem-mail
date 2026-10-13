package app.nemmail.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/**
 * The server-side codes of {@code API_ERROR_CODES} in @nem/shared, with the same HTTP statuses.
 * NETWORK and TIMEOUT only happen on the client, so they are not here.
 */
public enum ErrorCode {
  BAD_REQUEST(HttpStatus.BAD_REQUEST),
  VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_CONTENT),
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
  FORBIDDEN(HttpStatus.FORBIDDEN),
  NOT_FOUND(HttpStatus.NOT_FOUND),
  CONFLICT(HttpStatus.CONFLICT),
  PAYLOAD_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE),
  RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
  NOT_IMPLEMENTED(HttpStatus.NOT_IMPLEMENTED),
  INTERNAL(HttpStatus.INTERNAL_SERVER_ERROR);

  private final HttpStatus status;

  ErrorCode(HttpStatus status) {
    this.status = status;
  }

  public HttpStatus status() {
    return status;
  }

  /** The code for a status Spring picked, e.g. 405 or 415 become BAD_REQUEST. */
  public static ErrorCode of(HttpStatusCode status) {
    for (ErrorCode code : values()) {
      if (code.status.value() == status.value()) {
        return code;
      }
    }
    return status.is5xxServerError() ? INTERNAL : BAD_REQUEST;
  }
}
