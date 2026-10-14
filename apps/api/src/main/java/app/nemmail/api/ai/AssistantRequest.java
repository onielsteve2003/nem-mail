package app.nemmail.api.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** AssistantRequestSchema in @nem/shared; {@code threadId} is the open conversation, if any. */
record AssistantRequest(@NotBlank @Size(max = 2000) String prompt, UUID threadId) {}
