package app.nemmail.api.mail;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bulk thread ops: {@code applyThreadOp} in @nem/shared, over the user's entries (one per message).
 * Thread-wide flags go on every entry. Each method returns the ids of the threads the user has;
 * unknown ids are skipped, not an error.
 */
@Service
public class ThreadOpsService {

  /** Where a user files a thread; a thread is in at most one of them, or archived (null). */
  private static final Set<Mailbox> MOVABLE =
      EnumSet.of(Mailbox.INBOX, Mailbox.SPAM, Mailbox.TRASH);

  private final MailboxEntryRepository entries;
  private final MessageRepository messages;
  private final LabelRepository labels;

  ThreadOpsService(
      MailboxEntryRepository entries, MessageRepository messages, LabelRepository labels) {
    this.entries = entries;
    this.messages = messages;
    this.labels = labels;
  }

  @Transactional
  public List<UUID> markRead(UUID userId, List<UUID> threadIds) {
    return forEachEntry(userId, threadIds, entry -> entry.setRead(true));
  }

  /** Flags only each thread's latest message, as mail clients do. */
  @Transactional
  public List<UUID> markUnread(UUID userId, List<UUID> threadIds) {
    Map<UUID, List<MailboxEntry>> byThread = load(userId, threadIds);
    Map<UUID, Instant> sentAt = sentAt(byThread.values());
    byThread
        .values()
        .forEach(
            threadEntries ->
                threadEntries.stream()
                    .max(
                        Comparator.comparing((MailboxEntry e) -> sentAt.get(e.getMessageId()))
                            .thenComparing(MailboxEntry::getMessageId))
                    .ifPresent(latest -> latest.setRead(false)));
    return List.copyOf(byThread.keySet());
  }

  @Transactional
  public List<UUID> setStarred(UUID userId, List<UUID> threadIds, boolean isStarred) {
    return forEachEntry(userId, threadIds, entry -> entry.setStarred(isStarred));
  }

  @Transactional
  public List<UUID> setImportant(UUID userId, List<UUID> threadIds, boolean isImportant) {
    return forEachEntry(userId, threadIds, entry -> entry.setImportant(isImportant));
  }

  /** Out of the inbox; the thread stays in All mail. */
  @Transactional
  public List<UUID> archive(UUID userId, List<UUID> threadIds) {
    return forEachEntry(userId, threadIds, ThreadOpsService::leaveInbox);
  }

  /**
   * Trash, spam, not-spam and move: every entry filed among inbox, spam and trash (or archived)
   * goes to {@code to}. The user's own messages keep Sent and the like, so a thread brought back to
   * the inbox still shows in Sent.
   */
  @Transactional
  public List<UUID> move(UUID userId, List<UUID> threadIds, Mailbox to) {
    if (!MOVABLE.contains(to)) {
      throw Wire.invalid("op.to", "Threads move only to inbox, spam or trash.");
    }
    Map<UUID, List<MailboxEntry>> byThread = load(userId, threadIds);
    Map<UUID, Message> own = ownMessages(userId, byThread.values());
    byThread.values().stream()
        .flatMap(List::stream)
        .filter(entry -> entry.getMailbox() == null || MOVABLE.contains(entry.getMailbox()))
        .forEach(
            entry -> {
              Message message = own.get(entry.getMessageId());
              // The seed files a trashed thread's own messages in Trash too; restore them home.
              entry.setMailbox(
                  message != null && to == Mailbox.INBOX ? ownMailbox(message.getStatus()) : to);
            });
    return List.copyOf(byThread.keySet());
  }

  /** Muting also archives; later replies skip the inbox (FR-6.6). */
  @Transactional
  public List<UUID> setMuted(UUID userId, List<UUID> threadIds, boolean isMuted) {
    return forEachEntry(
        userId,
        threadIds,
        entry -> {
          entry.setMuted(isMuted);
          if (isMuted) {
            leaveInbox(entry);
          }
        });
  }

  @Transactional
  public List<UUID> setCategory(UUID userId, List<UUID> threadIds, Category category) {
    return forEachEntry(userId, threadIds, entry -> entry.setCategory(category));
  }

  /** Only the user's own labels can be added; any other id is a 422. */
  @Transactional
  public List<UUID> addLabels(UUID userId, List<UUID> threadIds, List<UUID> labelIds) {
    Set<UUID> owned =
        labels.findAllById(labelIds).stream()
            .filter(label -> label.getUserId().equals(userId))
            .map(Label::getId)
            .collect(Collectors.toSet());
    if (!owned.containsAll(labelIds)) {
      throw Wire.invalid("op.labelIds", "One or more labels were not found.");
    }
    return forEachEntry(userId, threadIds, entry -> entry.getLabelIds().addAll(owned));
  }

  @Transactional
  public List<UUID> removeLabels(UUID userId, List<UUID> threadIds, List<UUID> labelIds) {
    return forEachEntry(userId, threadIds, entry -> entry.getLabelIds().removeAll(labelIds));
  }

  /** It wakes up in the inbox, even if it was archived (FR-6.3). */
  @Transactional
  public List<UUID> snooze(UUID userId, List<UUID> threadIds, Instant until) {
    List<UUID> moved = move(userId, threadIds, Mailbox.INBOX);
    forEachEntry(userId, moved, entry -> entry.setSnoozedUntil(until));
    return moved;
  }

  @Transactional
  public List<UUID> unsnooze(UUID userId, List<UUID> threadIds) {
    return forEachEntry(userId, threadIds, entry -> entry.setSnoozedUntil(null));
  }

  /**
   * Wakes every snooze due by {@code now}, for all users (FR-6.3): the snooze is cleared and a
   * thread back in the inbox is unread again; one trashed or spammed meanwhile wakes quietly.
   * Returns how many threads came back to an inbox.
   */
  @Transactional
  public int wakeDue(Instant now) {
    Map<UUID, Set<UUID>> byUser =
        entries.findBySnoozedUntilLessThanEqualAndDeletedAtIsNull(now).stream()
            .collect(
                Collectors.groupingBy(
                    MailboxEntry::getUserId,
                    Collectors.mapping(
                        MailboxEntry::getThreadId, Collectors.toCollection(LinkedHashSet::new))));
    int woke = 0;
    for (Map.Entry<UUID, Set<UUID>> user : byUser.entrySet()) {
      List<UUID> threadIds = List.copyOf(user.getValue());
      List<UUID> back =
          load(user.getKey(), threadIds).entrySet().stream()
              .filter(thread -> inInbox(thread.getValue()))
              .map(Map.Entry::getKey)
              .toList();
      unsnooze(user.getKey(), threadIds);
      markUnread(user.getKey(), back);
      woke += back.size();
    }
    return woke;
  }

  private List<UUID> forEachEntry(
      UUID userId, List<UUID> threadIds, Consumer<MailboxEntry> change) {
    Map<UUID, List<MailboxEntry>> byThread = load(userId, threadIds);
    byThread.values().forEach(threadEntries -> threadEntries.forEach(change));
    return List.copyOf(byThread.keySet());
  }

  /** The user's live entries by thread, in request order; changes save when the method commits. */
  private Map<UUID, List<MailboxEntry>> load(UUID userId, List<UUID> threadIds) {
    Map<UUID, List<MailboxEntry>> found =
        entries.findByUserIdAndThreadIdInAndDeletedAtIsNull(userId, threadIds).stream()
            .collect(Collectors.groupingBy(MailboxEntry::getThreadId));
    Map<UUID, List<MailboxEntry>> ordered = new LinkedHashMap<>();
    threadIds.stream().filter(found::containsKey).forEach(id -> ordered.put(id, found.get(id)));
    return ordered;
  }

  private Map<UUID, Instant> sentAt(Collection<List<MailboxEntry>> byThread) {
    return messages(byThread).stream()
        .collect(Collectors.toMap(Message::getId, Message::getSentAt));
  }

  private Map<UUID, Message> ownMessages(UUID userId, Collection<List<MailboxEntry>> byThread) {
    return messages(byThread).stream()
        .filter(message -> userId.equals(message.getFromUserId()))
        .collect(Collectors.toMap(Message::getId, Function.identity()));
  }

  private List<Message> messages(Collection<List<MailboxEntry>> byThread) {
    return messages.findAllById(
        byThread.stream().flatMap(List::stream).map(MailboxEntry::getMessageId).toList());
  }

  /** As the inbox list sees it: some entry in the inbox and none in spam or trash. */
  private static boolean inInbox(List<MailboxEntry> threadEntries) {
    return threadEntries.stream().anyMatch(e -> e.getMailbox() == Mailbox.INBOX)
        && threadEntries.stream()
            .noneMatch(e -> e.getMailbox() == Mailbox.SPAM || e.getMailbox() == Mailbox.TRASH);
  }

  private static void leaveInbox(MailboxEntry entry) {
    if (entry.getMailbox() == Mailbox.INBOX) {
      entry.setMailbox(null);
    }
  }

  private static Mailbox ownMailbox(MessageStatus status) {
    return switch (status) {
      case SENT -> Mailbox.SENT;
      case SCHEDULED -> Mailbox.SCHEDULED;
      case OUTBOX -> Mailbox.OUTBOX;
      case DRAFT -> Mailbox.DRAFTS;
    };
  }
}
