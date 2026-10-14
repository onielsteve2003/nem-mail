package app.nemmail.api.mail;

import jakarta.persistence.LockModeType;
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
}
