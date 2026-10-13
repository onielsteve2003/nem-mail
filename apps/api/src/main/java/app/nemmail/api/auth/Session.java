package app.nemmail.api.auth;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A signed-in device. Only the SHA-256 of its bearer token is kept. */
@Entity
@Table(name = "sessions")
public class Session extends BaseEntity {

  private UUID userId;
  private byte[] tokenHash;
  private Instant expiresAt;
  private Instant createdAt;

  protected Session() {}

  public Session(UUID id, UUID userId, byte[] tokenHash, Instant expiresAt) {
    super(id);
    this.userId = userId;
    this.tokenHash = tokenHash.clone();
    this.expiresAt = expiresAt;
    this.createdAt = Instant.now();
  }

  public UUID getUserId() {
    return userId;
  }

  public byte[] getTokenHash() {
    return tokenHash.clone();
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant expiresAt) {
    this.expiresAt = expiresAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
