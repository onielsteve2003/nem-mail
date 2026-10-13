package app.nemmail.api.mail;

import app.nemmail.api.common.LowercaseEnumConverter;

/** Delivery state of a message (MessageStatus in @nem/shared). */
public enum MessageStatus {
  DRAFT,
  SCHEDULED,
  OUTBOX,
  SENT;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<MessageStatus> {
    public Converter() {
      super(MessageStatus.class);
    }
  }
}
