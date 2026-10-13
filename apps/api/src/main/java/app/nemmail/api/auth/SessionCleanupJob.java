package app.nemmail.api.auth;

import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes expired sessions nightly. An expired token is already rejected (and its row deleted) when
 * it is used; this catches the ones never used again.
 */
@Component
class SessionCleanupJob {

  private final SessionRepository sessions;

  SessionCleanupJob(SessionRepository sessions) {
    this.sessions = sessions;
  }

  @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
  @Transactional
  void deleteExpired() {
    sessions.deleteByExpiresAtBefore(Instant.now());
  }
}
