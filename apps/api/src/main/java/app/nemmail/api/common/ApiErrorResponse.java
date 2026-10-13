package app.nemmail.api.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/** The error envelope {@code { error: { code, message, details? } }} (ApiErrorSchema). */
public record ApiErrorResponse(Body error) {

  public record Body(
      ErrorCode code, String message, @JsonInclude(JsonInclude.Include.NON_NULL) Object details) {}

  public static ApiErrorResponse of(ErrorCode code, String message, Object details) {
    return new ApiErrorResponse(new Body(code, message, details));
  }
}
