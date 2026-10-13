package app.nemmail.api.auth;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

  private String email;
  private String name;
  private String passwordHash;
  private String avatarSeed;
  private Instant createdAt;

  protected User() {}

  public User(UUID id, String email, String name, String passwordHash, String avatarSeed) {
    super(id);
    this.email = email;
    this.name = name;
    this.passwordHash = passwordHash;
    this.avatarSeed = avatarSeed;
    this.createdAt = Instant.now();
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

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public String getAvatarSeed() {
    return avatarSeed;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
