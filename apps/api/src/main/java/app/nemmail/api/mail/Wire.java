package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ApiExceptionHandler.FieldProblem;
import app.nemmail.api.common.ErrorCode;
import java.util.List;
import java.util.Locale;

/** Enums as the lowercase strings of the Zod enums in @nem/shared. */
final class Wire {

  private Wire() {}

  static String name(Enum<?> value) {
    return value == null ? null : value.name().toLowerCase(Locale.ROOT);
  }

  /** Parses a lowercase value; null stays null, anything unknown is a 422 naming the field. */
  static <E extends Enum<E>> E parse(Class<E> type, String value, String field) {
    if (value == null) {
      return null;
    }
    for (E constant : type.getEnumConstants()) {
      if (name(constant).equals(value)) {
        return constant;
      }
    }
    throw invalid(field, "Unknown value \"" + value + "\".");
  }

  static ApiException invalid(String field, String message) {
    return new ApiException(
        ErrorCode.VALIDATION_FAILED,
        "Some fields are not valid.",
        List.of(new FieldProblem(field, message)));
  }
}
