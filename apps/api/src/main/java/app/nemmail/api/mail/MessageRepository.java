package app.nemmail.api.mail;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface MessageRepository extends JpaRepository<Message, UUID> {

  List<Message> findByThreadIdOrderBySentAt(UUID threadId);

  /** Delivery and undo both lock the message, so a send is never delivered and cancelled. */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from Message m where m.id = :id")
  Optional<Message> lockById(UUID id);

  boolean existsByThreadIdAndIdNot(UUID threadId, UUID id);

  /** Outbox and Scheduled messages due by {@code now}, oldest first, for the sweeper. */
  @Query(
      "select m.id from Message m where m.status in :statuses and m.sendAt <= :now"
          + " order by m.sendAt")
  List<UUID> findDueIds(Collection<MessageStatus> statuses, Instant now);
}
