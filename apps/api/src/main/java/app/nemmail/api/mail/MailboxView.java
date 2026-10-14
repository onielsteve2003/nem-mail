package app.nemmail.api.mail;

/**
 * The mailboxes a list can show (SystemMailbox in @nem/shared). Starred, snoozed, important and all
 * are views over entry flags; the rest are {@link Mailbox} folders.
 */
public enum MailboxView {
  INBOX,
  STARRED,
  SNOOZED,
  IMPORTANT,
  SENT,
  SCHEDULED,
  OUTBOX,
  DRAFTS,
  ALL,
  SPAM,
  TRASH
}
