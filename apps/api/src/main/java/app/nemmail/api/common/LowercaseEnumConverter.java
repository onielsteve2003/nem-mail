package app.nemmail.api.common;

import jakarta.persistence.AttributeConverter;
import java.util.Locale;

/**
 * Stores an enum as its lowercase name ({@code MOVE_CATEGORY} as {@code move_category}), the same
 * strings as the Zod enums and the database check constraints.
 */
public abstract class LowercaseEnumConverter<E extends Enum<E>>
    implements AttributeConverter<E, String> {

  private final Class<E> type;

  protected LowercaseEnumConverter(Class<E> type) {
    this.type = type;
  }

  @Override
  public String convertToDatabaseColumn(E value) {
    return value == null ? null : value.name().toLowerCase(Locale.ROOT);
  }

  @Override
  public E convertToEntityAttribute(String value) {
    return value == null ? null : Enum.valueOf(type, value.toUpperCase(Locale.ROOT));
  }
}
