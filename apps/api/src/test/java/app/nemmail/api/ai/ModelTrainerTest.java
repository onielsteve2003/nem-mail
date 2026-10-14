package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.ai.model.CategoryModel;
import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.PriorityModel;
import app.nemmail.api.ai.model.SpamModel;
import app.nemmail.api.auth.User;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.search.EmbeddingRepository;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatusCode;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class ModelTrainerTest {

  private static final String PASSWORD = "babbage-cabbage";
  private static final String LUNCH = "Lunch on Thursday?";
  private static final String LUNCH_BODY = "Want to grab lunch on Thursday near the office?";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private UserModels userModels;
  @Autowired private SeedModels seed;
  @Autowired private PriorityInputs priorityInputs;
  @Autowired private MlModelRepository mlModels;
  @Autowired private AiProperties properties;
  @Autowired private MessageRepository messages;
  @Autowired private EmbeddingRepository embeddings;
  @Autowired private JdbcClient jdbc;
  @Autowired private TransactionTemplate transactions;
  @Autowired private ApplicationEventPublisher events;
  @Autowired private JsonMapper json;

  private User grace;
  private String token;

  @BeforeEach
  void setUp() {
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    token = signIn(grace);
  }

  @Test
  void reportingSpamTrainsTheUsersOwnSpamModel() {
    MailboxEntry entry = received(LUNCH, LUNCH_BODY);
    double before = SpamModel.probability(seed.spam(), LUNCH + "\n" + LUNCH_BODY);

    patch(entry.getThreadId(), Map.of("op", "spam"));

    MlModel row = mlModels.findByUserIdAndKind(grace.getId(), ModelKind.SPAM).orElseThrow();
    assertThat(row.getVersion()).isEqualTo(1);
    double after = SpamModel.probability(userModels.spam(grace.getId()), LUNCH + "\n" + LUNCH_BODY);
    assertThat(after).isGreaterThan(before);
    assertThat(eventTypes()).containsExactly("spam");

    // "Not spam" pulls it back down and bumps the stored version.
    patch(entry.getThreadId(), Map.of("op", "notSpam"));
    assertThat(mlModels.findByUserIdAndKind(grace.getId(), ModelKind.SPAM))
        .get()
        .extracting(MlModel::getVersion)
        .isEqualTo(2);
    assertThat(SpamModel.probability(userModels.spam(grace.getId()), LUNCH + "\n" + LUNCH_BODY))
        .isLessThan(after);
    // Another user still has the seed model.
    assertThat(SpamModel.probability(userModels.spam(UUID.randomUUID()), LUNCH + "\n" + LUNCH_BODY))
        .isEqualTo(before);
  }

  @Test
  void movingToATabAndMarkingImportantTrainTheirModels() {
    MailboxEntry entry = received("Weekend sale", "Everything is 50% off. Use code SAVE50.");
    CategoryModel.Input input =
        new CategoryModel.Input("sender@outside.example", "Weekend sale", "Everything is 50% off.");
    double socialBefore = social(seed.category(), input);

    patch(entry.getThreadId(), Map.of("op", "setCategory", "category", "social"));
    assertThat(social(userModels.category(grace.getId()), input)).isGreaterThan(socialBefore);

    patch(entry.getThreadId(), Map.of("op", "markImportant"));
    PriorityModel.Input facts =
        priorityInputs.input(
            grace.getId(),
            new PriorityInputs.Mail(
                entry.getMessageId(),
                entry.getThreadId(),
                "sender@outside.example",
                "Weekend sale",
                "Everything is 50% off. Use code SAVE50.",
                "social"));
    assertThat(PriorityModel.score(seed.priority(), facts).value())
        .isLessThan(PriorityModel.IMPORTANT_THRESHOLD);
    // A mark steps until the thread is past the threshold with a margin.
    assertThat(PriorityModel.score(userModels.priority(grace.getId()), facts).value())
        .isGreaterThanOrEqualTo(PriorityModel.IMPORTANT_THRESHOLD + 0.1);
    assertThat(eventTypes()).containsExactly("move_category", "important");

    // Ops that teach nothing store nothing.
    patch(entry.getThreadId(), Map.of("op", "star"));
    assertThat(eventTypes()).hasSize(2);
  }

  @Test
  void feedbackEndpointLearnsFromOpensAndChecksItsInput() {
    MailboxEntry entry = received(LUNCH, LUNCH_BODY);
    String threadId = entry.getThreadId().toString();

    assertThat(feedback(Map.of("type", "open", "threadId", threadId)).value()).isEqualTo(200);
    MlModel row = mlModels.findByUserIdAndKind(grace.getId(), ModelKind.PRIORITY).orElseThrow();
    PriorityModel.Logistic learned = userModels.priority(grace.getId());
    assertThat(learned.getBias()).isGreaterThan(seed.priority().getBias());
    assertThat(json.readTree(row.getParams()).get("kind").asString()).isEqualTo("logistic");
    assertThat(eventTypes()).containsExactly("open");

    assertThat(feedback(Map.of("type", "moveCategory", "threadId", threadId)).value())
        .isEqualTo(422);
    assertThat(feedback(Map.of("type", "archive", "threadId", threadId)).value()).isEqualTo(422);
    assertThat(feedback(Map.of("type", "open")).value()).isEqualTo(422);
    // Someone else's thread is missing, as everywhere else.
    User ada = data.user("Ada");
    MailboxEntry adas = data.received(ada, "x@outside.example", "Hi", Instant.now());
    assertThat(feedback(Map.of("type", "open", "threadId", adas.getThreadId().toString())).value())
        .isEqualTo(404);
    assertThat(
            api.http()
                .post()
                .uri("/ai/feedback")
                .body(Map.of("type", "open", "threadId", threadId))
                .exchange((request, response) -> response.getStatusCode())
                .value())
        .isEqualTo(401);
  }

  @Test
  void ingestJudgesEachReaderWithTheirOwnModels() {
    // Grace has taught her model that lunch invitations are spam.
    NaiveBayes spam = seed.spam();
    for (int i = 0; i < 5; i++) {
      SpamModel.learnFeedback(spam, LUNCH + "\n" + LUNCH_BODY, true);
    }
    transactions.executeWithoutResult(
        status -> userModels.save(grace.getId(), ModelKind.SPAM, spam));
    MailboxEntry entry = received(LUNCH, LUNCH_BODY);

    pipeline().ingest(entry.getMessageId(), Set.of(grace.getId()));

    JsonNode thread = get("/threads/" + entry.getThreadId());
    assertThat(thread.get("mailboxes").get(0).asString()).isEqualTo("spam");
    assertThat(
            thread
                .get("messages")
                .get(0)
                .get("ai")
                .get("spam")
                .get("value")
                .get("isSpam")
                .asBoolean())
        .isTrue();
    // The message's own verdict (seed models) says otherwise.
    String stored =
        jdbc.sql("select ai::text from messages where id = :id")
            .param("id", entry.getMessageId())
            .query(String.class)
            .single();
    assertThat(json.readTree(stored).get("spam").get("value").get("isSpam").asBoolean()).isFalse();
  }

  @Test
  void ingestStoresTheReadersPriorityOnTheirCopy() {
    MailboxEntry entry = received(LUNCH, LUNCH_BODY);
    pipeline().ingest(entry.getMessageId(), Set.of(grace.getId()));
    JsonNode ai = get("/threads/" + entry.getThreadId()).get("messages").get(0).get("ai");
    assertThat(ai.get("priority").get("value").asDouble()).isBetween(0.0, 1.0);
    assertThat(ai.get("category").get("value").asString()).isNotBlank();
  }

  private MailboxEntry received(String subject, String body) {
    return data.received(grace, "sender@outside.example", subject, body, Instant.now());
  }

  private static double social(NaiveBayes model, CategoryModel.Input input) {
    return model.predict(CategoryModel.features(input)).probabilities().get("social");
  }

  private IngestPipeline pipeline() {
    AiProperties on =
        new AiProperties(
            new AiProperties.Ingest(true), properties.embeddings(), properties.ollama());
    return new IngestPipeline(
        on,
        seed,
        userModels,
        priorityInputs,
        messages,
        embeddings,
        Embedder.NONE,
        jdbc,
        transactions,
        events,
        json);
  }

  private List<String> eventTypes() {
    return jdbc.sql("select type from events where user_id = :user order by created_at")
        .param("user", grace.getId())
        .query(String.class)
        .list();
  }

  private void patch(UUID threadId, Map<String, Object> op) {
    api.as(token)
        .patch()
        .uri("/threads")
        .body(Map.of("ids", List.of(threadId.toString()), "op", op))
        .retrieve()
        .toBodilessEntity();
  }

  private HttpStatusCode feedback(Map<String, Object> body) {
    return api.as(token)
        .post()
        .uri("/ai/feedback")
        .body(body)
        .exchange((request, response) -> response.getStatusCode());
  }

  private JsonNode get(String path) {
    return api.as(token).get().uri(path).retrieve().body(JsonNode.class);
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
