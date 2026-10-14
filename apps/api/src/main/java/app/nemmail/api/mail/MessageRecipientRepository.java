package app.nemmail.api.mail;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRecipientRepository extends JpaRepository<MessageRecipient, UUID> {

  List<MessageRecipient> findByMessageIdIn(Collection<UUID> messageIds);

  List<MessageRecipient> findByMessageId(UUID messageId);
}
