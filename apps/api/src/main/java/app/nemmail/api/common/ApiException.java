package app.nemmail.api.common;

/** Thrown by services to answer with an error envelope; the message is shown to the user. */
public class ApiException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  private final ErrorCode code;
  private final transient Object details;

  public ApiException(ErrorCode code, String message) {
    this(code, message, null);
  }

  public ApiException(ErrorCode code, String message, Object details) {
    super(message);
    this.code = code;
    this.details = details;
  }

  public ErrorCode getCode() {
    return code;
  }

  public Object getDetails() {
    return details;
  }
}
