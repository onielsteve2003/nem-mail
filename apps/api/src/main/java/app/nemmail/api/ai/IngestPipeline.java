package app.nemmail.api.ai;

import app.nemmail.api.ai.model.AiInsight;
import app.nemmail.api.ai.model.CategoryModel;
import app.nemmail.api.ai.model.Extractor;
import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.Phishing;
import app.nemmail.api.ai.model.PriorityModel;
import app.nemmail.api.ai.model.SpamModel;
import app.nemmail.api.mail.MailEvents;
import app.nemmail.api.mail.Message;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.search.Embedding;
import app.nemmail.api.search.EmbeddingRepository;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Runs the mail models on each delivered message, after delivery commits, on its own virtual
 * thread, so sending never waits for AI. As the app does on device: spam goes to Spam; other mail
 * gets a tab (unless the thread already has one, which may be the user's choice) and the Important
 * marker when its priority score is high. Each reader is judged by their own models ({@link
 * UserModels}), and their results (with priority) go on their copy in {@code mailbox_entries.ai};
 * {@code messages.ai} keeps the seed models' verdict for everyone else, such as the sender. Then,
 * if server embeddings are on, the message gets its vector.
 */
@Component
public class IngestPipeline {

  /** MiniLM reads about 256 word pieces; this is comfortably more text than that. */
  private static final int EMBED_CHARS = 2000;

  private static final Logger log = LoggerFactory.getLogger(IngestPipeline.class);

  private final boolean enabled;
  private final SeedModels seed;
  private final UserModels models;
  private final PriorityInputs priorityInputs;
  private final MessageRepository messages;
  private final EmbeddingRepository embeddings;
  private final Embedder embedder;
  private final JdbcClient jdbc;
  private final TransactionTemplate transactions;
  private final ApplicationEventPublisher events;
  private final JsonMapper json;

  IngestPipeline(
      AiProperties properties,
      SeedModels seed,
      UserModels models,
      PriorityInputs priorityInputs,
      MessageRepository messages,
      EmbeddingRepository embeddings,
      Embedder embedder,
      JdbcClient jdbc,
      TransactionTemplate transactions,
      ApplicationEventPublisher events,
      JsonMapper json) {
    this.enabled = properties.ingest().enabled();
    this.seed = seed;
    this.models = models;
    this.priorityInputs = priorityInputs;
    this.messages = messages;
    this.embeddings = embeddings;
    this.embedder = embedder;
    this.jdbc = jdbc;
    this.transactions = transactions;
    this.events = events;
    this.json = json;
  }

  @TransactionalEventListener
  void on(MailEvents.MessageDelivered delivered) {
    if (!enabled) {
      return;
    }
    Thread.ofVirtual().name("ai-ingest").start(() -> run(delivered));
  }

  private void run(MailEvents.MessageDelivered delivered) {
    try {
      ingest(delivered.messageId(), delivered.inbox());
    } catch (RuntimeException e) {
      log.warn("AI ingest of message {} failed", delivered.messageId(), e);
    }
    try {
      embed(delivered.messageId());
    } catch (RuntimeException e) {
      log.warn("Embedding message {} failed", delivered.messageId(), e);
    }
  }

  /**
   * Classifies the message with the seed models (its stored, reader-free verdict), then each
   * reader's copy with that reader's own models, and files it; a repeat call does nothing.
   */
  public void ingest(UUID messageId, Set<UUID> readers) {
    transactions.executeWithoutResult(
        status -> {
          Message message = messages.findById(messageId).orElse(null);
          if (message == null || message.getAi() != null) {
            return;
          }
          AiInsight<List<Extractor.Extraction>> extractions =
              Extractor.extract(
                  new Extractor.Input(
                      message.getSubject(), message.getBodyText(), message.getSentAt()),
                  // The server has no reader's time zone yet; "Friday" counts from the UTC day.
                  ZoneOffset.UTC);
          Insights ai = classify(message, seed.spam(), seed.category(), extractions);
          jdbc.sql("update messages set ai = cast(:ai as jsonb) where id = :id and ai is null")
              .param("ai", json.writeValueAsString(ai.json()))
              .param("id", messageId)
              .update();

          Set<UUID> filed = new LinkedHashSet<>();
          for (UUID reader : readers) {
            if (file(reader, message, extractions)) {
              filed.add(reader);
            }
          }
          if (!filed.isEmpty()) {
            // Counts only: the rows themselves change on the client's next refresh.
            events.publishEvent(new MailEvents.NewMail(message.getThreadId(), Set.of(), filed));
          }
        });
  }

  /** One message's results; {@code tab} is null for spam. */
  private record Insights(
      AiInsight<SpamModel.Verdict> spam,
      AiInsight<String> tab,
      AiInsight<List<Extractor.Extraction>> extractions) {

    /** The AIInsights JSON shape, plus a reader's priority when given. */
    Map<String, Object> json(AiInsight<Double> priority) {
      Map<String, Object> ai = new LinkedHashMap<>();
      if (tab != null) {
        ai.put("category", tab);
      }
      ai.put("spam", spam);
      if (priority != null) {
        ai.put("priority", priority);
      }
      if (extractions != null) {
        ai.put("extractions", extractions);
      }
      return ai;
    }

    Map<String, Object> json() {
      return json(null);
    }
  }

  /** Spam (phishing rules included), then a tab unless spam. */
  private static Insights classify(
      Message message,
      NaiveBayes spam,
      NaiveBayes category,
      AiInsight<List<Extractor.Extraction>> extractions) {
    AiInsight<SpamModel.Verdict> verdict =
        SpamModel.classify(
            spam,
            new Phishing.Input(
                Optional.ofNullable(message.getFromName()).orElse(""),
                message.getFromEmail(),
                message.getSubject(),
                message.getBodyText(),
                message.getBodyHtml()));
    AiInsight<String> tab =
        verdict.value().isSpam()
            ? null
            : CategoryModel.classify(
                category,
                new CategoryModel.Input(
                    message.getFromEmail(), message.getSubject(), message.getBodyText()));
    return new Insights(verdict, tab, extractions);
  }

  /**
   * Classifies the reader's copy with their models and files it while it is still in their inbox,
   * storing their results on it. Targeted updates, so a flag the reader changed in the meantime is
   * not overwritten. Returns whether anything changed.
   */
  private boolean file(
      UUID reader, Message message, AiInsight<List<Extractor.Extraction>> extractions) {
    Insights ai = classify(message, models.spam(reader), models.category(reader), extractions);
    if (ai.spam().value().isSpam()) {
      return jdbc.sql(
                  "update mailbox_entries set mailbox = 'spam', category = null,"
                      + " ai = cast(:ai as jsonb)"
                      + " where user_id = :reader and message_id = :message and mailbox = 'inbox'")
              .param("ai", json.writeValueAsString(ai.json()))
              .param("reader", reader)
              .param("message", message.getId())
              .update()
          > 0;
    }
    // A tab already set by an earlier message of the thread stays (the reader may have moved it).
    boolean hasTab =
        jdbc.sql(
                "select exists (select 1 from mailbox_entries where user_id = :reader"
                    + " and thread_id = :thread and message_id <> :message"
                    + " and category is not null)")
            .param("reader", reader)
            .param("thread", message.getThreadId())
            .param("message", message.getId())
            .query(Boolean.class)
            .single();
    String category = ai.tab().value();
    if (!hasTab) {
      jdbc.sql(
              "update mailbox_entries set category = :category"
                  + " where user_id = :reader and message_id = :message and mailbox = 'inbox'")
          .param("category", category)
          .param("reader", reader)
          .param("message", message.getId())
          .update();
    } else {
      category =
          jdbc.sql(
                  "select category from mailbox_entries where user_id = :reader"
                      + " and message_id = :message")
              .param("reader", reader)
              .param("message", message.getId())
              .query(String.class)
              .optional()
              .orElse(category);
    }
    AiInsight<Double> score =
        PriorityModel.score(
            models.priority(reader),
            priorityInputs.input(
                reader,
                new PriorityInputs.Mail(
                    message.getId(),
                    message.getThreadId(),
                    message.getFromEmail(),
                    message.getSubject(),
                    message.getBodyText(),
                    category)));
    jdbc.sql(
            "update mailbox_entries set ai = cast(:ai as jsonb),"
                + " is_important = is_important or :important"
                + " where user_id = :reader and message_id = :message and mailbox = 'inbox'")
        .param("ai", json.writeValueAsString(ai.json(score)))
        .param("important", score.value() >= PriorityModel.IMPORTANT_THRESHOLD)
        .param("reader", reader)
        .param("message", message.getId())
        .update();
    return true;
  }

  /** Stores the message's vector when server embeddings are on and loaded. */
  public void embed(UUID messageId) {
    if (!embedder.ready() || embeddings.existsById(messageId)) {
      return;
    }
    Message message = messages.findById(messageId).orElse(null);
    if (message == null) {
      return;
    }
    String text = message.getSubject() + "\n" + message.getBodyText();
    String input = text.length() > EMBED_CHARS ? text.substring(0, EMBED_CHARS) : text;
    embedder
        .embed(List.of(input))
        .map(List::getFirst)
        .filter(vector -> vector.length == Embedding.DIMENSIONS)
        .ifPresent(vector -> embeddings.save(new Embedding(messageId, vector)));
  }
}
