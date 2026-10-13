package app.nemmail.api.mail;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DraftRepository extends JpaRepository<Draft, UUID> {

  List<Draft> findByUserIdOrderByUpdatedAtDesc(UUID userId);
}
