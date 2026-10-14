package app.nemmail.api.ai;

import app.nemmail.api.common.LowercaseEnumConverter;

/** User actions the models learn from. */
public enum EventType {
  OPEN,
  REPLY,
  SPAM,
  NOT_SPAM,
  MOVE_CATEGORY,
  IMPORTANT,
  NOT_IMPORTANT;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<EventType> {
    public Converter() {
      super(EventType.class);
    }
  }
}
