package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A user's labels, with the rules of MockLabelRepository in the app. */
@Service
public class LabelService {

  static final int NAME_MAX = 50;

  private final LabelRepository labels;

  LabelService(LabelRepository labels) {
    this.labels = labels;
  }

  /** Labels in name order. */
  @Transactional(readOnly = true)
  public List<Label> list(UUID userId) {
    return labels.findByUserIdOrderByName(userId);
  }

  @Transactional
  public Label create(UUID userId, LabelRequest.Create request) {
    Label label =
        new Label(
            UUID.randomUUID(),
            userId,
            name(request.name()),
            Wire.parse(LabelColor.class, request.color(), "color"),
            request.parentId());
    check(label, labels.findByUserIdOrderByName(userId));
    return labels.save(label);
  }

  @Transactional
  public Label update(UUID userId, UUID labelId, LabelRequest.Update request) {
    List<Label> own = labels.findByUserIdOrderByName(userId);
    Label label =
        own.stream()
            .filter(l -> l.getId().equals(labelId))
            .findFirst()
            .orElseThrow(LabelService::notFound);
    if (request.name() != null) {
      label.setName(name(request.name()));
    }
    if (request.color() != null) {
      label.setColor(Wire.parse(LabelColor.class, request.color(), "color"));
    }
    if (request.hasParentId()) {
      label.setParentId(request.parentId());
    }
    check(label, own);
    return label;
  }

  /**
   * Its sub-labels move to the top level and threads lose it (entry_labels cascades). A sub-label
   * whose name a top-level label already has is a 409, and nothing changes.
   */
  @Transactional
  public void delete(UUID userId, UUID labelId) {
    List<Label> own = labels.findByUserIdOrderByName(userId);
    Label label =
        own.stream()
            .filter(l -> l.getId().equals(labelId))
            .findFirst()
            .orElseThrow(LabelService::notFound);
    own.stream().filter(l -> labelId.equals(l.getParentId())).forEach(l -> l.setParentId(null));
    labels.delete(label);
    try {
      labels.flush();
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(
          ErrorCode.CONFLICT, "A sub-label has the same name as a top-level label.");
    }
  }

  /** Names are unique among siblings (ignoring case) and labels nest one level (FR-2.4). */
  private static void check(Label label, List<Label> existing) {
    String name = label.getName().toLowerCase(Locale.ROOT);
    List<Label> others = existing.stream().filter(l -> !l.getId().equals(label.getId())).toList();
    boolean taken =
        others.stream()
            .anyMatch(
                l ->
                    Objects.equals(l.getParentId(), label.getParentId())
                        && l.getName().toLowerCase(Locale.ROOT).equals(name));
    if (taken) {
      throw new ApiException(ErrorCode.CONFLICT, "A label with that name already exists.");
    }
    if (label.getParentId() == null) {
      return;
    }
    Label parent =
        others.stream().filter(l -> l.getId().equals(label.getParentId())).findFirst().orElse(null);
    boolean hasChildren = others.stream().anyMatch(l -> label.getId().equals(l.getParentId()));
    if (parent == null || parent.getParentId() != null || hasChildren) {
      throw Wire.invalid("parentId", "Labels nest one level deep.");
    }
  }

  private static String name(String raw) {
    String name = raw.strip();
    if (name.isEmpty() || name.length() > NAME_MAX) {
      throw Wire.invalid("name", "Use 1 to " + NAME_MAX + " characters.");
    }
    return name;
  }

  private static ApiException notFound() {
    return new ApiException(ErrorCode.NOT_FOUND, "Label not found.");
  }
}
