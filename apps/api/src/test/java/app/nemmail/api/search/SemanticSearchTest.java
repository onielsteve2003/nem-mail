package app.nemmail.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.ai.Embedder;
import app.nemmail.api.auth.User;
import app.nemmail.api.common.PageResponse;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.ThreadService;
import app.nemmail.api.mail.ThreadSummaryResponse;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

/**
 * Hybrid search with hand-made vectors: the fake embedder maps each query to a direction, and each
 * message's vector says how close in meaning it is. Real MiniLM runs are not part of the build.
 */
@IntegrationTest
class SemanticSearchTest {

  private static final String PASSWORD = "babbage-cabbage";
  private static final String FROM = "agent@travel.example";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private SearchRepository repository;
  @Autowired private ThreadService threads;
  @Autowired private EmbeddingRepository embeddings;

  private User grace;
  private UUID flight;
  private UUID dinner;
  private UUID photos;

  @BeforeEach
  void setUp() {
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    Instant now = Instant.now();
    flight = thread("Flight to Lisbon", "Your boarding pass for the trip.", now, 1, 0);
    dinner = thread("Dinner", "A table for two at eight.", now.minusSeconds(60), 0, 1);
    photos = thread("Trip photos", "Photos from the trip.", now.minusSeconds(120), 0.6f, 0.8f);
  }

  @Test
  void findsThreadsByMeaningAloneAboveTheThreshold() {
    // "vacation" is in no message; meaning finds the flight (1.0) and the photos (0.6).
    assertThat(ids(service(1, 0).search(grace.getId(), "vacation", true, null, 50)))
        .containsExactly(flight, photos);
    // Without semantic it is a keyword search, which finds nothing.
    assertThat(service(1, 0).search(grace.getId(), "vacation", false, null, 50).items()).isEmpty();
  }

  @Test
  void blendsKeywordHitsWithMeaning() {
    // "trip" matches the flight and the photos by keyword; dinner gets in on meaning alone.
    List<UUID> found = ids(service(0, 1).search(grace.getId(), "trip", true, null, 50));
    assertThat(found).containsExactlyInAnyOrder(flight, photos, dinner);
    // Photos: keyword plus 0.8 similar beats the flight's keyword alone and dinner's meaning.
    assertThat(found.getFirst()).isEqualTo(photos);
  }

  @Test
  void operatorsStillFilterAndPagesFollowTheBlend() {
    // As close in meaning as the flight, but from someone else.
    MailboxEntry holiday =
        data.received(grace, "someone@else.example", "Holiday", "Beach days.", Instant.now());
    embeddings.save(new Embedding(holiday.getMessageId(), vector(1, 0)));
    SearchService search = service(1, 0);
    assertThat(ids(search.search(grace.getId(), "vacation from:travel", true, null, 50)))
        .containsExactly(flight, photos);

    PageResponse<ThreadSummaryResponse> first =
        search.search(grace.getId(), "vacation from:travel", true, null, 1);
    assertThat(ids(first)).containsExactly(flight);
    assertThat(
            ids(search.search(grace.getId(), "vacation from:travel", true, first.nextCursor(), 1)))
        .containsExactly(photos);
  }

  @Test
  void theApiFallsBackToKeywordsWhileServerEmbeddingsAreOff() {
    String token =
        api.http()
            .post()
            .uri("/auth/signin")
            .body(Map.of("email", grace.getEmail(), "password", PASSWORD))
            .retrieve()
            .body(JsonNode.class)
            .get("token")
            .asString();
    JsonNode page =
        api.as(token)
            .get()
            .uri("/search?q={q}&semantic=true", "lisbon")
            .retrieve()
            .body(JsonNode.class);
    assertThat(page.get("items")).hasSize(1);
    assertThat(page.get("items").get(0).get("id").asString()).isEqualTo(flight.toString());
  }

  /** A one-message thread for Grace whose message points at (x, y, 0, ...). */
  private UUID thread(String subject, String body, Instant at, float x, float y) {
    MailboxEntry entry = data.received(grace, FROM, subject, body, at);
    embeddings.save(new Embedding(entry.getMessageId(), vector(x, y)));
    return entry.getThreadId();
  }

  /** Search whose embedder turns any query into (x, y, 0, ...). */
  private SearchService service(float x, float y) {
    Embedder fake =
        new Embedder() {
          @Override
          public boolean ready() {
            return true;
          }

          @Override
          public Optional<List<float[]>> embed(List<String> texts) {
            return Optional.of(List.of(vector(x, y)));
          }
        };
    return new SearchService(repository, threads, fake);
  }

  private static float[] vector(float x, float y) {
    float[] vector = new float[Embedding.DIMENSIONS];
    vector[0] = x;
    vector[1] = y;
    return vector;
  }

  private static List<UUID> ids(PageResponse<ThreadSummaryResponse> page) {
    return page.items().stream().map(ThreadSummaryResponse::id).toList();
  }
}
