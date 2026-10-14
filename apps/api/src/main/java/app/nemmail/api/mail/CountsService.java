package app.nemmail.api.mail;

import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Badge counts ({@code countsFor} in the mock): unread threads per mailbox (drafts, outbox and
 * scheduled count every item), unread inbox threads per tab, and unread threads per label.
 */
@Service
public class CountsService {

  private static final Set<MailboxView> COUNT_ALL =
      EnumSet.of(MailboxView.DRAFTS, MailboxView.OUTBOX, MailboxView.SCHEDULED);

  private final CountsRepository counts;

  CountsService(CountsRepository counts) {
    this.counts = counts;
  }

  @Transactional(readOnly = true)
  public Response counts(UUID userId, Instant now) {
    List<CountsRepository.ThreadFlags> threads = counts.threads(userId, now);
    Map<String, Long> mailboxes = new LinkedHashMap<>();
    for (MailboxView mailbox : MailboxView.values()) {
      Predicate<CountsRepository.ThreadFlags> in = inView(mailbox);
      boolean all = COUNT_ALL.contains(mailbox);
      mailboxes.put(
          Wire.name(mailbox),
          threads.stream().filter(t -> (all || t.unread()) && in.test(t)).count());
    }
    mailboxes.put(Wire.name(MailboxView.DRAFTS), counts.drafts(userId));

    Map<String, Long> categories = new LinkedHashMap<>();
    Map<UUID, Long> labels = new LinkedHashMap<>();
    Predicate<CountsRepository.ThreadFlags> inInbox = inView(MailboxView.INBOX);
    for (CountsRepository.ThreadFlags thread : threads) {
      if (!thread.unread()) {
        continue;
      }
      if (thread.category() != null && inInbox.test(thread)) {
        categories.merge(thread.category(), 1L, Long::sum);
      }
      if (!binned(thread)) {
        thread.labelIds().forEach(id -> labels.merge(id, 1L, Long::sum));
      }
    }
    return new Response(mailboxes, categories, labels);
  }

  /** The list views' rules ({@code inMailbox} in @nem/shared, as ThreadListRepository runs it). */
  private static Predicate<CountsRepository.ThreadFlags> inView(MailboxView mailbox) {
    return switch (mailbox) {
      case INBOX -> t -> t.mailboxes().contains("inbox") && !binned(t) && !t.snoozed();
      case SPAM, TRASH -> t -> t.mailboxes().contains(Wire.name(mailbox));
      case STARRED -> t -> t.starred() && !binned(t);
      case IMPORTANT -> t -> t.important() && !binned(t);
      case SNOOZED -> t -> t.snoozed() && !binned(t);
      case ALL -> t -> !binned(t);
      case SENT, SCHEDULED, OUTBOX, DRAFTS ->
          t -> t.mailboxes().contains(Wire.name(mailbox)) && !binned(t);
    };
  }

  private static boolean binned(CountsRepository.ThreadFlags thread) {
    return thread.mailboxes().contains("spam") || thread.mailboxes().contains("trash");
  }

  /** CountsResponseSchema in @nem/shared. */
  public record Response(
      Map<String, Long> mailboxes, Map<String, Long> categories, Map<UUID, Long> labels) {}
}
