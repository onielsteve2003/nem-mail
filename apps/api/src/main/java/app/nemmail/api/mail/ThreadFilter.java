package app.nemmail.api.mail;

import java.util.UUID;

/** Which list to show (ThreadListFilter in @nem/shared): a mailbox, maybe one tab, or a label. */
public sealed interface ThreadFilter {

  record InMailbox(MailboxView mailbox, Category category) implements ThreadFilter {}

  record WithLabel(UUID labelId) implements ThreadFilter {}
}
