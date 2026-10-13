package app.nemmail.api.ai;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A user's learned model parameters, one row per kind. */
@Entity
@Table(name = "ml_models")
public class MlModel extends BaseEntity {

  private UUID userId;

  @Convert(converter = ModelKind.Converter.class)
  private ModelKind kind;

  @JdbcTypeCode(SqlTypes.JSON)
  private String params;

  private int version;
  private Instant updatedAt;

  protected MlModel() {}

  public MlModel(UUID id, UUID userId, ModelKind kind, String params) {
    super(id);
    this.userId = userId;
    this.kind = kind;
    this.params = params;
    this.version = 1;
    this.updatedAt = Instant.now();
  }

  public UUID getUserId() {
    return userId;
  }

  public ModelKind getKind() {
    return kind;
  }

  public String getParams() {
    return params;
  }

  public int getVersion() {
    return version;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  /** Stores newly learned parameters and bumps the version. */
  public void update(String params) {
    this.params = params;
    this.version++;
    this.updatedAt = Instant.now();
  }
}
