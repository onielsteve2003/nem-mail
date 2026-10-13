package app.nemmail.api.mail;

import app.nemmail.api.common.LowercaseEnumConverter;

/** Label colors (LabelColor in @nem/shared). */
public enum LabelColor {
  NEUTRAL,
  VIOLET,
  LIME,
  CYAN,
  CORAL,
  AMBER;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<LabelColor> {
    public Converter() {
      super(LabelColor.class);
    }
  }
}
