package app.nemmail.api.settings;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A user's Settings JSON from @nem/shared; the id is the user's id. */
@Entity
@Table(name = "settings")
@AttributeOverride(name = "id", column = @Column(name = "user_id"))
public class UserSettings extends BaseEntity {

  @JdbcTypeCode(SqlTypes.JSON)
  private String data;

  protected UserSettings() {}

  public UserSettings(UUID userId, String data) {
    super(userId);
    this.data = data;
  }

  public String getData() {
    return data;
  }

  public void setData(String data) {
    this.data = data;
  }
}
