package app.nemmail.api.mail;

import app.nemmail.api.common.LowercaseEnumConverter;

/** Mailboxes a message is filed in (StoredMailbox in @nem/shared); null means archived. */
public enum Mailbox {
  INBOX,
  SENT,
  SCHEDULED,
  OUTBOX,
  DRAFTS,
  SPAM,
  TRASH;

  /** Stored as the lowercase name. */
  public static class Converter extends LowercaseEnumConverter<Mailbox> {
    public Converter() {
      super(Mailbox.class);
    }
  }
}
