package app.nemmail.api.mail;

import app.nemmail.api.common.LowercaseEnumConverter;

/** Which header a recipient is in. */
public enum RecipientKind {
  TO,
  CC,
  BCC;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<RecipientKind> {
    public Converter() {
      super(RecipientKind.class);
    }
  }
}
