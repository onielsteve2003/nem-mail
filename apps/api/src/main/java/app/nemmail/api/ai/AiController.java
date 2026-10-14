package app.nemmail.api.ai;

import app.nemmail.api.ai.model.AiInsight;
import app.nemmail.api.ai.model.TextRank;
import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ApiExceptionHandler.FieldProblem;
import app.nemmail.api.common.ErrorCode;
import app.nemmail.api.common.Ok;
import app.nemmail.api.mail.Category;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AiController {

  private final ModelTrainer trainer;
  private final ThreadAi threadAi;
  private final Assistant assistant;

  AiController(ModelTrainer trainer, ThreadAi threadAi, Assistant assistant) {
    this.trainer = trainer;
    this.threadAi = threadAi;
    this.assistant = assistant;
  }

  /** AI-3: an extractive summary with action items, cached until the thread changes. */
  @PostMapping("/ai/summary")
  AiInsight<TextRank.Summary> summary(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody ThreadRefRequest body) {
    return threadAi.summary(current.userId(), body.threadId());
  }

  /** AI-4: up to three short replies to the latest message from someone else. */
  @PostMapping("/ai/replies")
  AiInsight<List<String>> replies(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody ThreadRefRequest body) {
    return threadAi.replies(current.userId(), body.threadId());
  }

  /** AI-11: summarize unread, what needs a reply, or a drafted reply, picked by the prompt. */
  @PostMapping("/ai/assistant")
  AssistantResponse assistant(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody AssistantRequest body) {
    return assistant.answer(current.userId(), body.prompt(), body.threadId());
  }

  /**
   * A learning event the client saw (open, reply) or a report made outside a bulk op. Spam, not
   * spam, tab moves and important marks made with {@code PATCH /threads} already teach the models.
   */
  @PostMapping("/ai/feedback")
  Ok feedback(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody FeedbackRequest body) {
    EventType type =
        switch (body.type()) {
          case "open" -> EventType.OPEN;
          case "reply" -> EventType.REPLY;
          case "spam" -> EventType.SPAM;
          case "notSpam" -> EventType.NOT_SPAM;
          case "moveCategory" -> EventType.MOVE_CATEGORY;
          default -> throw invalid("type", "Unknown value \"" + body.type() + "\".");
        };
    if (type == EventType.MOVE_CATEGORY
        && Arrays.stream(Category.values())
            .noneMatch(c -> c.name().toLowerCase(Locale.ROOT).equals(body.category()))) {
      throw invalid("category", "Pass the tab the thread was moved to.");
    }
    if (!trainer.holds(current.userId(), body.threadId())) {
      throw new ApiException(ErrorCode.NOT_FOUND, "This conversation was not found.");
    }
    trainer.learn(
        current.userId(),
        type,
        List.of(body.threadId()),
        type == EventType.MOVE_CATEGORY ? body.category() : null);
    return Ok.OK;
  }

  static ApiException invalid(String field, String message) {
    return new ApiException(
        ErrorCode.VALIDATION_FAILED,
        "Some fields are not valid.",
        List.of(new FieldProblem(field, message)));
  }
}
