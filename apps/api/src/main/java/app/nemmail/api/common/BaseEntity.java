package app.nemmail.api.common;

import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * UUID ids assigned in Java, so a new entity knows its id before it is saved and the seed can pick
 * stable ones. {@link Persistable} tells Spring Data to insert rather than merge.
 */
@MappedSuperclass
public abstract class BaseEntity implements Persistable<UUID> {

  @Id private UUID id;

  @Transient private boolean isNew = true;

  protected BaseEntity() {
    this(UUID.randomUUID());
  }

  protected BaseEntity(UUID id) {
    this.id = id;
  }

  @Override
  public UUID getId() {
    return id;
  }

  @Override
  public boolean isNew() {
    return isNew;
  }

  @PostLoad
  @PostPersist
  void markNotNew() {
    isNew = false;
  }

  @Override
  public boolean equals(Object other) {
    return this == other
        || (other != null && getClass() == other.getClass() && id.equals(((BaseEntity) other).id));
  }

  @Override
  public int hashCode() {
    return id.hashCode();
  }
}
