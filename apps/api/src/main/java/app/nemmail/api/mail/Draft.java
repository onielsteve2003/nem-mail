package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** An unsent message, kept as the Draft JSON from @nem/shared. */
@Entity
@Table(name = "drafts")
public class Draft extends BaseEntity {

  private UUID userId;
  private UUID threadId;

  @JdbcTypeCode(SqlTypes.JSON)
  private String payload;

  private Instant updatedAt;

  protected Draft() {}

  public Draft(UUID id, UUID userId, UUID threadId, String payload, Instant updatedAt) {
    super(id);
    this.userId = userId;
    this.threadId = threadId;
    this.payload = payload;
    this.updatedAt = updatedAt;
  }

  public UUID getUserId() {
    return userId;
  }

  public UUID getThreadId() {
    return threadId;
  }

  public String getPayload() {
    return payload;
  }

  public void setPayload(String payload, Instant updatedAt) {
    this.payload = payload;
    this.updatedAt = updatedAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
