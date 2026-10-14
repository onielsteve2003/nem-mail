package app.nemmail.api.mail;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Label request bodies (CreateLabelRequestSchema and UpdateLabelRequestSchema in @nem/shared). */
final class LabelRequest {

  private LabelRequest() {}

  /** {@code POST /labels}; name length and color are checked by {@link LabelService}. */
  record Create(@NotNull String name, @NotNull String color, UUID parentId) {}

  /**
   * {@code PATCH /labels/:id}: every field is optional. A {@code parentId} of null moves the label
   * to the top level, so it is told apart from an absent one.
   */
  static final class Update {

    private String name;
    private String color;
    private UUID parentId;
    private boolean hasParentId;

    String name() {
      return name;
    }

    void setName(String name) {
      this.name = name;
    }

    String color() {
      return color;
    }

    void setColor(String color) {
      this.color = color;
    }

    UUID parentId() {
      return parentId;
    }

    boolean hasParentId() {
      return hasParentId;
    }

    @JsonSetter
    void setParentId(UUID parentId) {
      this.parentId = parentId;
      this.hasParentId = true;
    }
  }

  /** LabelSchema. */
  record Response(UUID id, String name, String color, UUID parentId) {

    static Response of(Label label) {
      return new Response(
          label.getId(), label.getName(), Wire.name(label.getColor()), label.getParentId());
    }
  }
}
