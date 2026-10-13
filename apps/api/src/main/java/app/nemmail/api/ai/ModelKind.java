package app.nemmail.api.ai;

import app.nemmail.api.common.LowercaseEnumConverter;

/** On-device models whose learned parameters sync to the server. */
public enum ModelKind {
  SPAM,
  PRIORITY,
  CATEGORY,
  NGRAM;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<ModelKind> {
    public Converter() {
      super(ModelKind.class);
    }
  }
}
