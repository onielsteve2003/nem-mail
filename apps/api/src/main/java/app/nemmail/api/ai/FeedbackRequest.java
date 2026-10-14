package app.nemmail.api.ai;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** FeedbackRequestSchema in @nem/shared; {@code category} is required for moveCategory. */
record FeedbackRequest(@NotNull String type, @NotNull UUID threadId, String category) {}
