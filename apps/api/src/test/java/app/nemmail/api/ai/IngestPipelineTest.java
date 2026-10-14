package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.DeliveryService;
import app.nemmail.api.mail.MailEvents;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.search.Embedding;
import app.nemmail.api.search.EmbeddingRepository;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class IngestPipelineTest {

  private static final String PASSWORD = "babbage-cabbage";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private DeliveryService delivery;
  @Autowired private IngestPipeline pipeline;
  @Autowired private AiProperties properties;
  @Autowired private SeedModels seed;
  @Autowired private MessageRepository messages;
  @Autowired private EmbeddingRepository embeddings;
  @Autowired private JdbcClient jdbc;
  @Autowired private TransactionTemplate transactions;
  @Autowired private ApplicationEventPublisher events;
  @Autowired private JsonMapper json;

  private String adaToken;
  private String graceToken;
  private User grace;

  @BeforeEach
  void setUp() {
    User ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    adaToken = signIn(ada);
    graceToken = signIn(grace);
  }

  @Test
  void movesSpamToSpamAndKeepsTheVerdictOnTheMessage() throws Exception {
    JsonNode thread =
        deliverAndWait(
            null,
            "CONGRATULATIONS winner!!!",
            "You won $5,000 cash. Claim your free prize now before it expires.");

    assertThat(strings(thread.get("mailboxes"))).containsExactly("spam");
    JsonNode ai = thread.get("messages").get(0).get("ai");
    assertThat(ai.get("spam").get("value").get("isSpam").asBoolean()).isTrue();
    assertThat(ai.get("spam").get("source").asString()).isEqualTo("model");
    assertThat(ai.has("category")).isFalse();
    assertThat(thread.get("ai").get("spam").get("value").get("isSpam").asBoolean()).isTrue();
    // The sender's copy stays in Sent.
    JsonNode adas = get(adaToken, "/threads/" + thread.get("id").asString());
    assertThat(strings(adas.get("mailboxes"))).containsExactly("sent");
  }

  @Test
  void sortsIntoATabMarksImportantAndFindsDates() throws Exception {
    JsonNode urgent =
        deliverAndWait(
            null,
            "Contract",
            "Could you review the contract and sign it today? The meeting is on Friday at 3pm.");
    assertThat(strings(urgent.get("mailboxes"))).containsExactly("inbox");
    assertThat(urgent.get("category").asString()).isEqualTo("primary");
    assertThat(urgent.get("isImportant").asBoolean()).isTrue();
    JsonNode ai = urgent.get("messages").get(0).get("ai");
    assertThat(ai.get("category").get("value").asString()).isEqualTo("primary");
    assertThat(ai.get("spam").get("value").get("isSpam").asBoolean()).isFalse();
    List<String> kinds = ai.get("extractions").get("value").findValuesAsString("kind");
    assertThat(kinds).contains("meeting");

    JsonNode sale =
        deliverAndWait(
            null, "Weekend sale", "Everything is 50% off this weekend. Use code SAVE50.");
    assertThat(sale.get("category").asString()).isEqualTo("promotions");
    assertThat(sale.get("isImportant").asBoolean()).isFalse();
  }

  @Test
  void keepsATabTheReaderChoseForTheThread() throws Exception {
    JsonNode first =
        deliverAndWait(null, "Weekend sale", "Everything is 50% off. Use code SAVE50.");
    String threadId = first.get("id").asString();
    api.as(graceToken)
        .patch()
        .uri("/threads")
        .body(
            Map.of(
                "ids", List.of(threadId), "op", Map.of("op", "setCategory", "category", "social")))
        .retrieve()
        .toBodilessEntity();

    JsonNode second =
        deliverAndWait(threadId, "Re: Weekend sale", "Still 50% off. Use code SAVE50.");
    assertThat(second.get("category").asString()).isEqualTo("social");
    assertThat(second.get("messages").get(1).get("ai").get("category").get("value").asString())
        .isEqualTo("promotions");
  }

  @Test
  void isOffInTheSharedTestContextAndRepeatsAreHarmless() throws Exception {
    JsonNode thread = deliverAndWait(null, "Hello", "Hi");
    String messageId = thread.get("messages").get(0).get("id").asString();
    String ai = thread.get("messages").get(0).get("ai").toString();
    pipeline.ingest(UUID.fromString(messageId), Set.of(grace.getId()));
    assertThat(
            get(graceToken, "/threads/" + thread.get("id").asString())
                .get("messages")
                .get(0)
                .get("ai")
                .toString())
        .isEqualTo(ai);

    // The context's own pipeline ignores delivery events (nem.ai.ingest.enabled=false).
    JsonNode unscreened = send(null, "Hello again", "Hi");
    pipeline.on(
        new MailEvents.MessageDelivered(
            UUID.fromString(unscreened.get("messageId").asString()), Set.of(grace.getId())));
    Thread.sleep(300);
    assertThat(
            get(graceToken, "/threads/" + unscreened.get("threadId").asString())
                .get("messages")
                .get(0)
                .has("ai"))
        .isFalse();
  }

  @Test
  void storesAnEmbeddingWhenTheEmbedderIsReady() throws Exception {
    JsonNode thread = deliverAndWait(null, "Notes", "Here are the notes from today.");
    UUID messageId = UUID.fromString(thread.get("messages").get(0).get("id").asString());
    float[] vector = new float[Embedding.DIMENSIONS];
    vector[0] = 1;
    Embedder fake =
        new Embedder() {
          @Override
          public boolean ready() {
            return true;
          }

          @Override
          public Optional<List<float[]>> embed(List<String> texts) {
            assertThat(texts).containsExactly("Notes\nHere are the notes from today.");
            return Optional.of(List.of(vector));
          }
        };
    pipeline(fake).embed(messageId);

    assertThat(embeddings.findById(messageId))
        .get()
        .extracting(Embedding::getVector)
        .isEqualTo(vector);
    // The default (off) embedder stores nothing.
    pipeline.embed(UUID.randomUUID());
  }

  /** A pipeline with ingest on, as in production. */
  private IngestPipeline pipeline(Embedder embedder) {
    AiProperties on =
        new AiProperties(
            new AiProperties.Ingest(true), properties.embeddings(), properties.ollama());
    return new IngestPipeline(
        on, seed, messages, embeddings, embedder, jdbc, transactions, events, json);
  }

  /**
   * Ada sends to Grace (a reply when {@code threadId} is set), the delivery event goes to a
   * pipeline with ingest on, and this returns Grace's thread once the message is filed.
   */
  private JsonNode deliverAndWait(String threadId, String subject, String text) throws Exception {
    JsonNode sent = send(threadId, subject, text);
    String messageId = sent.get("messageId").asString();
    pipeline(Embedder.NONE)
        .on(new MailEvents.MessageDelivered(UUID.fromString(messageId), Set.of(grace.getId())));

    String path = "/threads/" + sent.get("threadId").asString();
    long deadline = System.currentTimeMillis() + 10_000;
    while (System.currentTimeMillis() < deadline) {
      JsonNode thread = get(graceToken, path);
      JsonNode latest = thread.get("messages").get(thread.get("messages").size() - 1);
      if (latest.get("id").asString().equals(messageId) && latest.has("ai")) {
        return thread;
      }
      Thread.sleep(50);
    }
    throw new AssertionError("message " + messageId + " was not ingested within 10 s");
  }

  /** Sends and delivers at once; returns the send response. */
  private JsonNode send(String threadId, String subject, String text) {
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", UUID.randomUUID().toString());
    draft.put("mode", threadId == null ? "new" : "reply");
    draft.put("threadId", threadId);
    draft.put("inReplyTo", null);
    draft.put("to", List.of(Map.of("email", grace.getEmail())));
    draft.put("cc", List.of());
    draft.put("bcc", List.of());
    draft.put("subject", subject);
    draft.put("bodyHtml", "<p>" + text + "</p>");
    draft.put("attachments", List.of());
    draft.put("scheduledAt", null);
    draft.put("updatedAt", Instant.now().toString());
    JsonNode sent =
        api.as(adaToken)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft))
            .retrieve()
            .body(JsonNode.class);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));
    return sent;
  }

  private JsonNode get(String token, String path) {
    return api.as(token).get().uri(path).retrieve().body(JsonNode.class);
  }

  private static List<String> strings(JsonNode array) {
    return array.valueStream().map(JsonNode::asString).toList();
  }

  private String signIn(User user) {
    return api.http()
        .post()
        .uri("/auth/signin")
        .body(Map.of("email", user.getEmail(), "password", PASSWORD))
        .retrieve()
        .body(JsonNode.class)
        .get("token")
        .asString();
  }
}
