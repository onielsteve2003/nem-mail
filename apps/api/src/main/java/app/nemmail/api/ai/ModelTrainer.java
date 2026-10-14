package app.nemmail.api.ai;

import app.nemmail.api.ai.model.CategoryModel;
import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.PriorityModel;
import app.nemmail.api.ai.model.SpamModel;
import app.nemmail.api.mail.MailEvents;
import app.nemmail.api.mail.ThreadOp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Per-user learning, as the app does on device: "Report spam" / "Not spam" train the spam model,
 * "Move to tab" the category model, "Mark (not) important" the priority model (stepping until the
 * thread lands past the threshold), and an open or a reply nudges priority up by one small step.
 * Each lesson is kept in {@code events}; the trained model goes to {@code ml_models}.
 */
@Service
public class ModelTrainer {

  private static final Logger log = LoggerFactory.getLogger(ModelTrainer.class);

  private final UserModels models;
  private final PriorityInputs priorityInputs;
  private final EventRepository events;
  private final JdbcClient jdbc;
  private final TransactionTemplate transactions;
  private final JsonMapper json;

  ModelTrainer(
      UserModels models,
      PriorityInputs priorityInputs,
      EventRepository events,
      JdbcClient jdbc,
      TransactionTemplate transactions,
      JsonMapper json) {
    this.models = models;
    this.priorityInputs = priorityInputs;
    this.events = events;
    this.jdbc = jdbc;
    this.transactions = transactions;
    this.json = json;
  }

  /** The lesson a bulk op teaches, or null. System moves (ingest) do not go through ops. */
  static EventType lesson(ThreadOp op) {
    return switch (op) {
      case ThreadOp.Spam _ -> EventType.SPAM;
      case ThreadOp.Move move when "spam".equals(move.to()) -> EventType.SPAM;
      case ThreadOp.NotSpam _ -> EventType.NOT_SPAM;
      case ThreadOp.SetCategory _ -> EventType.MOVE_CATEGORY;
      case ThreadOp.MarkImportant _ -> EventType.IMPORTANT;
      case ThreadOp.MarkNotImportant _ -> EventType.NOT_IMPORTANT;
      default -> null;
    };
  }

  /** Learns from {@code PATCH /threads}; a failed lesson never fails the op. */
  @EventListener
  void on(MailEvents.OpApplied applied) {
    EventType type = lesson(applied.op());
    if (type == null) {
      return;
    }
    String category = applied.op() instanceof ThreadOp.SetCategory set ? set.category() : null;
    try {
      learn(applied.userId(), type, applied.threadIds(), category);
    } catch (RuntimeException e) {
      log.warn("Learning {} for user {} failed", type, applied.userId(), e);
    }
  }

  /** Whether the user has the thread (another user's counts as missing). */
  public boolean holds(UUID userId, UUID threadId) {
    return jdbc.sql(
            "select exists (select 1 from mailbox_entries where user_id = :user"
                + " and thread_id = :thread and deleted_at is null)")
        .param("user", userId)
        .param("thread", threadId)
        .query(Boolean.class)
        .single();
  }

  /**
   * Records the lesson for each thread and trains on the mail others sent in them (the user's own
   * replies teach nothing). {@code category} is the tab for {@link EventType#MOVE_CATEGORY}.
   */
  public void learn(UUID userId, EventType type, List<UUID> threadIds, String category) {
    transactions.executeWithoutResult(
        status -> {
          for (UUID threadId : threadIds) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("threadId", threadId);
            if (category != null) {
              payload.put("category", category);
            }
            events.save(
                new Event(UUID.randomUUID(), userId, type, json.writeValueAsString(payload)));
          }
          List<PriorityInputs.Mail> received = received(userId, threadIds);
          if (!received.isEmpty()) {
            train(userId, type, received, category);
          }
        });
  }

  private void train(
      UUID userId, EventType type, List<PriorityInputs.Mail> received, String category) {
    switch (type) {
      case SPAM, NOT_SPAM -> {
        NaiveBayes model = models.spam(userId);
        received.forEach(
            mail ->
                SpamModel.learnFeedback(
                    model, mail.subject() + "\n" + mail.bodyText(), type == EventType.SPAM));
        models.save(userId, ModelKind.SPAM, model);
      }
      case MOVE_CATEGORY -> {
        NaiveBayes model = models.category(userId);
        received.forEach(
            mail ->
                CategoryModel.learnFeedback(
                    model,
                    new CategoryModel.Input(mail.fromEmail(), mail.subject(), mail.bodyText()),
                    category));
        models.save(userId, ModelKind.CATEGORY, model);
      }
      case IMPORTANT, NOT_IMPORTANT, OPEN, REPLY -> {
        PriorityModel.Logistic model = models.priority(userId);
        boolean marked = type == EventType.IMPORTANT || type == EventType.NOT_IMPORTANT;
        // Priority is per thread: its latest message from someone else stands for it.
        Map<UUID, PriorityInputs.Mail> latest = new LinkedHashMap<>();
        received.forEach(mail -> latest.put(mail.threadId(), mail));
        latest
            .values()
            .forEach(
                mail ->
                    PriorityModel.learnFeedback(
                        model,
                        priorityInputs.input(userId, mail),
                        type != EventType.NOT_IMPORTANT,
                        marked));
        models.save(userId, ModelKind.PRIORITY, model);
      }
    }
  }

  /** The user's copies of mail from others in these threads, oldest first. */
  private List<PriorityInputs.Mail> received(UUID userId, List<UUID> threadIds) {
    return jdbc.sql(
            "select m.id, m.thread_id, m.from_email, m.subject, m.body_text, e.category"
                + " from mailbox_entries e join messages m on m.id = e.message_id"
                + " where e.user_id = :user and e.thread_id in (:threads)"
                + " and e.deleted_at is null and m.from_user_id is distinct from :user"
                + " order by m.sent_at, m.id")
        .param("user", userId)
        .param("threads", threadIds)
        .query(PriorityInputs.Mail.class)
        .list();
  }
}
