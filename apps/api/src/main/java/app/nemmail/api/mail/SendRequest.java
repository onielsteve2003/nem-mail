package app.nemmail.api.mail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/** {@code POST /send} (SendRequestSchema); no {@code sendAt} means after the undo window. */
public record SendRequest(@NotNull @Valid DraftBody draft, Instant sendAt) {

  /** SendResponseSchema: the send can be cancelled until {@code sendAt}. */
  public record Response(UUID messageId, UUID threadId, Instant sendAt) {}
}
