package app.nemmail.api.auth;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque bearer tokens: 32 random bytes, base64url-encoded for the client. Only their SHA-256 is
 * stored, so a database leak gives no usable tokens. Sessions last 30 days from their last use.
 */
@Service
public class SessionService {

  static final Duration LIFETIME = Duration.ofDays(30);

  /** Renew at most once a day, so authenticated requests are not each a write. */
  private static final Duration RENEW_AFTER = Duration.ofDays(1);

  private static final int TOKEN_BYTES = 32;

  private final SecureRandom random = new SecureRandom();
  private final SessionRepository sessions;

  SessionService(SessionRepository sessions) {
    this.sessions = sessions;
  }

  public record Issued(String token, Instant expiresAt) {}

  @Transactional
  public Issued issue(User user) {
    byte[] raw = new byte[TOKEN_BYTES];
    random.nextBytes(raw);
    Instant expiresAt = Instant.now().plus(LIFETIME);
    sessions.save(new Session(UUID.randomUUID(), user.getId(), sha256(raw), expiresAt));
    return new Issued(Base64.getUrlEncoder().withoutPadding().encodeToString(raw), expiresAt);
  }

  /** The signed-in user for a token, renewing the session; empty when unknown or expired. */
  @Transactional
  public Optional<CurrentUser> authenticate(String token) {
    byte[] raw = decode(token);
    if (raw == null) {
      return Optional.empty();
    }
    Optional<Session> found = sessions.findByTokenHash(sha256(raw));
    if (found.isEmpty()) {
      return Optional.empty();
    }
    Session session = found.get();
    Instant now = Instant.now();
    if (!session.getExpiresAt().isAfter(now)) {
      sessions.delete(session);
      return Optional.empty();
    }
    Instant renewed = now.plus(LIFETIME);
    if (Duration.between(session.getExpiresAt(), renewed).compareTo(RENEW_AFTER) > 0) {
      session.setExpiresAt(renewed);
    }
    return Optional.of(new CurrentUser(session.getUserId(), session.getId()));
  }

  @Transactional
  public void revoke(UUID sessionId) {
    sessions.deleteById(sessionId);
  }

  static byte[] sha256(byte[] raw) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(raw);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("Every JDK ships SHA-256", e);
    }
  }

  private static byte[] decode(String token) {
    try {
      byte[] raw = Base64.getUrlDecoder().decode(token);
      return raw.length == TOKEN_BYTES ? raw : null;
    } catch (IllegalArgumentException e) {
      return null;
    }
  }
}
