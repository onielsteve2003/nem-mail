package app.nemmail.api.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository extends JpaRepository<Session, UUID> {

  Optional<Session> findByTokenHash(byte[] tokenHash);

  long deleteByExpiresAtBefore(Instant cutoff);
}
