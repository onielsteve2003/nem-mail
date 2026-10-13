package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/** A user's label; labels nest one level deep (FR-2.4). */
@Entity
@Table(name = "labels")
public class Label extends BaseEntity {

  private UUID userId;
  private String name;

  @Convert(converter = LabelColor.Converter.class)
  private LabelColor color;

  private UUID parentId;

  protected Label() {}

  public Label(UUID id, UUID userId, String name, LabelColor color, UUID parentId) {
    super(id);
    this.userId = userId;
    this.name = name;
    this.color = color;
    this.parentId = parentId;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public LabelColor getColor() {
    return color;
  }

  public void setColor(LabelColor color) {
    this.color = color;
  }

  public UUID getParentId() {
    return parentId;
  }

  public void setParentId(UUID parentId) {
    this.parentId = parentId;
  }
}
