package app.nemmail.api.mail;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {

  List<Attachment> findByMessageIdIn(Collection<UUID> messageIds);

  List<Attachment> findByMessageId(UUID messageId);

  /** The file when the user uploaded it or has a copy of its message; otherwise empty. */
  @Query(
      value =
          "select a.* from attachments a where a.id = :id and (a.user_id = :userId"
              + " or exists (select 1 from mailbox_entries e where e.message_id = a.message_id"
              + " and e.user_id = :userId and e.deleted_at is null))",
      nativeQuery = true)
  Optional<Attachment> findReadable(UUID userId, UUID id);
}
