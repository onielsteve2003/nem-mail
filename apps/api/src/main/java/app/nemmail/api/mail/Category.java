package app.nemmail.api.mail;

import app.nemmail.api.common.LowercaseEnumConverter;

/** Inbox tabs (Category in @nem/shared). */
public enum Category {
  PRIMARY,
  PROMOTIONS,
  SOCIAL,
  UPDATES,
  FORUMS;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<Category> {
    public Converter() {
      super(Category.class);
    }
  }
}
