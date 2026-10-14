package app.nemmail.api.mail;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Application events published inside the transaction that made the change and handled once it
 * commits: the realtime stream ({@link EventStream}) and the AI ingest pipeline.
 */
public final class MailEvents {

  private MailEvents() {}

  /**
   * A message landed in {@code threadId}. {@code inbox} users got it in their inbox (mail.new);
   * every user in {@code touched} had a mailbox change (counts).
   */
  public record NewMail(UUID threadId, Set<UUID> inbox, Set<UUID> touched) {}

  /** A message reached the inbox of each of {@code inbox} (Nem Mail recipients, not the sender). */
  public record MessageDelivered(UUID messageId, Set<UUID> inbox) {}

  /** The user applied {@code op} to {@code threadIds}; the AI learns from some ops. */
  public record OpApplied(UUID userId, ThreadOp op, List<UUID> threadIds) {}

  /** The user's snoozes came due; {@code threadIds} are the ones back in the inbox. */
  record SnoozeWoke(UUID userId, List<UUID> threadIds) {}
}
