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
 * marker when its priority score is high. The message keeps the content-level results (spam,
 * category, extractions) in {@code messages.ai}; priority depends on the reader, so it only sets
 * each reader's marker. Then, if server embeddings are on, the message gets its vector.
 */
@Component
public class IngestPipeline {

  /** MiniLM reads about 256 word pieces; this is comfortably more text than that. */
  private static final int EMBED_CHARS = 2000;

  private static final Logger log = LoggerFactory.getLogger(IngestPipeline.class);

  private final boolean enabled;
  private final MessageRepository messages;
  private final EmbeddingRepository embeddings;
  private final Embedder embedder;
  private final JdbcClient jdbc;
  private final TransactionTemplate transactions;
  private final ApplicationEventPublisher events;
  private final JsonMapper json;
  // Seed models, read-only here; per-user models replace them in T18.3.
  private final NaiveBayes spam;
  private final NaiveBayes category;
  private final PriorityModel.Logistic priority;

  IngestPipeline(
      AiProperties properties,
      SeedModels seed,
      MessageRepository messages,
      EmbeddingRepository embeddings,
      Embedder embedder,
      JdbcClient jdbc,
      TransactionTemplate transactions,
      ApplicationEventPublisher events,
      JsonMapper json) {
    this.enabled = properties.ingest().enabled();
    this.messages = messages;
    this.embeddings = embeddings;
    this.embedder = embedder;
    this.jdbc = jdbc;
    this.transactions = transactions;
    this.events = events;
    this.json = json;
    this.spam = seed.spam();
    this.category = seed.category();
    this.priority = seed.priority();
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

  /** Classifies the message and files each reader's inbox copy; a repeat call does nothing. */
  public void ingest(UUID messageId, Set<UUID> readers) {
    transactions.executeWithoutResult(
        status -> {
          Message message = messages.findById(messageId).orElse(null);
          if (message == null || message.getAi() != null) {
            return;
          }
          AiInsight<SpamModel.Verdict> spamVerdict =
              SpamModel.classify(
                  spam,
                  new Phishing.Input(
                      Optional.ofNullable(message.getFromName()).orElse(""),
                      message.getFromEmail(),
                      message.getSubject(),
                      message.getBodyText(),
                      message.getBodyHtml()));
          boolean isSpam = spamVerdict.value().isSpam();
          AiInsight<String> tab =
              isSpam
                  ? null
                  : CategoryModel.classify(
                      category,
                      new CategoryModel.Input(
                          message.getFromEmail(), message.getSubject(), message.getBodyText()));
          AiInsight<List<Extractor.Extraction>> extractions =
              Extractor.extract(
                  new Extractor.Input(
                      message.getSubject(), message.getBodyText(), message.getSentAt()),
                  // The server has no reader's time zone yet; "Friday" counts from the UTC day.
                  ZoneOffset.UTC);

          Map<String, Object> ai = new LinkedHashMap<>();
          if (tab != null) {
            ai.put("category", tab);
          }
          ai.put("spam", spamVerdict);
          if (extractions != null) {
            ai.put("extractions", extractions);
          }
          jdbc.sql("update messages set ai = cast(:ai as jsonb) where id = :id and ai is null")
              .param("ai", json.writeValueAsString(ai))
              .param("id", messageId)
              .update();

          Set<UUID> filed = new LinkedHashSet<>();
          for (UUID reader : readers) {
            if (file(reader, message, isSpam, tab)) {
              filed.add(reader);
            }
          }
          if (!filed.isEmpty()) {
            // Counts only: the rows themselves change on the client's next refresh.
            events.publishEvent(new MailEvents.NewMail(message.getThreadId(), Set.of(), filed));
          }
        });
  }

  /**
   * Files the reader's copy while it is still in their inbox; targeted updates, so a flag the
   * reader changed in the meantime is not overwritten. Returns whether anything changed.
   */
  private boolean file(UUID reader, Message message, boolean isSpam, AiInsight<String> tab) {
    if (isSpam) {
      return jdbc.sql(
                  "update mailbox_entries set mailbox = 'spam', category = null"
                      + " where user_id = :reader and message_id = :message and mailbox = 'inbox'")
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
    String category = tab.value();
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
        PriorityModel.score(priority, priorityInput(reader, message, category));
    if (score.value() >= PriorityModel.IMPORTANT_THRESHOLD) {
      jdbc.sql(
              "update mailbox_entries set is_important = true"
                  + " where user_id = :reader and message_id = :message and mailbox = 'inbox'")
          .param("reader", reader)
          .param("message", message.getId())
          .update();
    }
    return true;
  }

  private PriorityModel.Input priorityInput(UUID reader, Message message, String category) {
    record Facts(
        boolean direct, int recipients, int messageCount, boolean attachments, int frequency) {}
    Facts facts =
        jdbc.sql(
                "select"
                    + " exists (select 1 from message_recipients where message_id = :message"
                    + "   and user_id = :reader and kind <> 'bcc') as direct,"
                    + " (select count(*) from message_recipients where message_id = :message)"
                    + "   as recipients,"
                    + " (select message_count from threads where id = :thread) as message_count,"
                    + " exists (select 1 from attachments where message_id = :message)"
                    + "   as attachments,"
                    // This delivery already counted the sender once; the model wants the history.
                    + " coalesce((select greatest(frequency - 1, 0) from contacts"
                    + "   where owner_id = :reader and lower(email) = lower(:from)), 0) as frequency")
            .param("message", message.getId())
            .param("reader", reader)
            .param("thread", message.getThreadId())
            .param("from", message.getFromEmail())
            .query(Facts.class)
            .single();
    return new PriorityModel.Input(
        message.getFromEmail(),
        message.getSubject(),
        message.getBodyText(),
        facts.direct(),
        facts.recipients(),
        facts.messageCount(),
        category,
        facts.attachments(),
        facts.frequency());
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
