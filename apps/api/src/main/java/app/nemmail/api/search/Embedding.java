package app.nemmail.api.search;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A message's MiniLM sentence embedding; the id is the message's id. Similarity queries use SQL
 * through {@code JdbcClient}, not this entity.
 */
@Entity
@Table(name = "embeddings")
@AttributeOverride(name = "id", column = @Column(name = "message_id"))
public class Embedding extends BaseEntity {

  public static final int DIMENSIONS = 384;

  @JdbcTypeCode(SqlTypes.VECTOR)
  @Array(length = DIMENSIONS)
  private float[] vector;

  protected Embedding() {}

  public Embedding(UUID messageId, float[] vector) {
    super(messageId);
    this.vector = vector.clone();
  }

  public float[] getVector() {
    return vector.clone();
  }
}
