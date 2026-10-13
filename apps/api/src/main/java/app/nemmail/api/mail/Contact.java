package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Someone the owner has mailed with; ranks recipient autocomplete. */
@Entity
@Table(name = "contacts")
public class Contact extends BaseEntity {

  private UUID ownerId;
  private String email;
  private String name;
  private Instant lastContactedAt;
  private int frequency;

  protected Contact() {}

  public Contact(UUID id, UUID ownerId, String email, String name) {
    super(id);
    this.ownerId = ownerId;
    this.email = email;
    this.name = name;
  }

  public UUID getOwnerId() {
    return ownerId;
  }

  public String getEmail() {
    return email;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public Instant getLastContactedAt() {
    return lastContactedAt;
  }

  public int getFrequency() {
    return frequency;
  }

  public void setHistory(int frequency, Instant lastContactedAt) {
    this.frequency = frequency;
    this.lastContactedAt = lastContactedAt;
  }
}
