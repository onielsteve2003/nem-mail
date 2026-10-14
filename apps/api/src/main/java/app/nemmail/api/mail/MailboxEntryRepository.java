package app.nemmail.api.mail;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailboxEntryRepository extends JpaRepository<MailboxEntry, UUID> {

  List<MailboxEntry> findByUserIdAndThreadId(UUID userId, UUID threadId);

  /** The user's live entries (not deleted forever) in these threads. */
  List<MailboxEntry> findByUserIdAndThreadIdInAndDeletedAtIsNull(
      UUID userId, Collection<UUID> threadIds);

  /** The user's live entries filed in {@code mailbox}. */
  List<MailboxEntry> findByUserIdAndMailboxAndDeletedAtIsNull(UUID userId, Mailbox mailbox);

  /** Live entries whose snooze is over by {@code now}, for the sweeper. */
  List<MailboxEntry> findBySnoozedUntilLessThanEqualAndDeletedAtIsNull(Instant now);
}
