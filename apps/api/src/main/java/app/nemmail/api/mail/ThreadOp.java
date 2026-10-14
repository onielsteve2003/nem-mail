package app.nemmail.api.mail;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A bulk op for {@code PATCH /threads} (ThreadOpSchema in @nem/shared), picked by {@code op}. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "op")
@JsonSubTypes({
  @JsonSubTypes.Type(value = ThreadOp.MarkRead.class, name = "markRead"),
  @JsonSubTypes.Type(value = ThreadOp.MarkUnread.class, name = "markUnread"),
  @JsonSubTypes.Type(value = ThreadOp.Star.class, name = "star"),
  @JsonSubTypes.Type(value = ThreadOp.Unstar.class, name = "unstar"),
  @JsonSubTypes.Type(value = ThreadOp.MarkImportant.class, name = "markImportant"),
  @JsonSubTypes.Type(value = ThreadOp.MarkNotImportant.class, name = "markNotImportant"),
  @JsonSubTypes.Type(value = ThreadOp.Archive.class, name = "archive"),
  @JsonSubTypes.Type(value = ThreadOp.Trash.class, name = "trash"),
  @JsonSubTypes.Type(value = ThreadOp.Spam.class, name = "spam"),
  @JsonSubTypes.Type(value = ThreadOp.NotSpam.class, name = "notSpam"),
  @JsonSubTypes.Type(value = ThreadOp.Mute.class, name = "mute"),
  @JsonSubTypes.Type(value = ThreadOp.Unmute.class, name = "unmute"),
  @JsonSubTypes.Type(value = ThreadOp.Move.class, name = "move"),
  @JsonSubTypes.Type(value = ThreadOp.SetCategory.class, name = "setCategory"),
  @JsonSubTypes.Type(value = ThreadOp.AddLabels.class, name = "addLabels"),
  @JsonSubTypes.Type(value = ThreadOp.RemoveLabels.class, name = "removeLabels"),
  @JsonSubTypes.Type(value = ThreadOp.Snooze.class, name = "snooze"),
  @JsonSubTypes.Type(value = ThreadOp.Unsnooze.class, name = "unsnooze")
})
public sealed interface ThreadOp {

  record MarkRead() implements ThreadOp {}

  record MarkUnread() implements ThreadOp {}

  record Star() implements ThreadOp {}

  record Unstar() implements ThreadOp {}

  record MarkImportant() implements ThreadOp {}

  record MarkNotImportant() implements ThreadOp {}

  record Archive() implements ThreadOp {}

  record Trash() implements ThreadOp {}

  record Spam() implements ThreadOp {}

  record NotSpam() implements ThreadOp {}

  record Mute() implements ThreadOp {}

  record Unmute() implements ThreadOp {}

  /** {@code to} is inbox, spam or trash. */
  record Move(@NotNull String to) implements ThreadOp {}

  record SetCategory(@NotNull String category) implements ThreadOp {}

  record AddLabels(@NotEmpty List<@NotNull UUID> labelIds) implements ThreadOp {}

  record RemoveLabels(@NotEmpty List<@NotNull UUID> labelIds) implements ThreadOp {}

  record Snooze(@NotNull Instant until) implements ThreadOp {}

  record Unsnooze() implements ThreadOp {}
}
