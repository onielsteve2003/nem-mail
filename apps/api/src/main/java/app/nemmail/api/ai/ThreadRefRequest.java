package app.nemmail.api.ai;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** ThreadRefRequestSchema in @nem/shared. */
record ThreadRefRequest(@NotNull UUID threadId) {}
