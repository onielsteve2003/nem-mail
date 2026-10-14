package app.nemmail.api.mail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** {@code PATCH /threads} (BulkThreadRequestSchema in @nem/shared). */
public record BulkThreadRequest(
    @NotEmpty @Size(max = 500) List<@NotNull UUID> ids, @NotNull @Valid ThreadOp op) {

  /** BulkThreadResponseSchema: the threads that were found and changed. */
  public record Response(List<UUID> updatedIds) {}
}
