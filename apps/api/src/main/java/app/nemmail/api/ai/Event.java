package app.nemmail.api.ai;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A user action the models learn from, such as reporting spam. */
@Entity
@Table(name = "events")
public class Event extends BaseEntity {

  private UUID userId;

  @Convert(converter = EventType.Converter.class)
  private EventType type;

  @JdbcTypeCode(SqlTypes.JSON)
  private String payload;

  private Instant createdAt;

  protected Event() {}

  public Event(UUID id, UUID userId, EventType type, String payload) {
    super(id);
    this.userId = userId;
    this.type = type;
    this.payload = payload;
    this.createdAt = Instant.now();
  }

  public UUID getUserId() {
    return userId;
  }

  public EventType getType() {
    return type;
  }

  public String getPayload() {
    return payload;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
