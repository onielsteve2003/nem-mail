package app.nemmail.api.ai;

import app.nemmail.api.ai.model.Extractor;
import java.util.List;
import java.util.UUID;

/** AssistantResponseSchema in @nem/shared: the answer and the threads it drew on. */
record AssistantResponse(
    String text, List<UUID> threadIds, List<Extractor.Extraction> extractions) {}
