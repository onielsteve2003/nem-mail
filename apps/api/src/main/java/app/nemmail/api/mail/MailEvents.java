package app.nemmail.api.mail;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Application events for the realtime stream, published inside the transaction that made the change
 * and handled once it commits ({@link EventStream}).
 */
final class MailEvents {

  private MailEvents() {}

  /**
   * A message landed in {@code threadId}. {@code inbox} users got it in their inbox (mail.new);
   * every user in {@code touched} had a mailbox change (counts).
   */
  record NewMail(UUID threadId, Set<UUID> inbox, Set<UUID> touched) {}

  /** The user's snoozes came due; {@code threadIds} are the ones back in the inbox. */
  record SnoozeWoke(UUID userId, List<UUID> threadIds) {}
}
