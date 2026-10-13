package app.nemmail.api.seed;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class DemoTest {

  /** Set for every integration test in {@code @IntegrationTest}. */
  private static final String KEY = "test-reset-key";

  private static final String DEMO_PASSWORD = "demo-account";

  @Autowired private ApiClient api;
  @Autowired private DemoService demo;
  @Autowired private TestData data;
  @Autowired private UserRepository users;
  @Autowired private JdbcClient jdbc;

  private SeedData seed;
  private UUID alex;
  private String alexEmail;

  @BeforeEach
  void setUp() {
    seed = demo.seed().orElseThrow();
    alex = SeedLoader.idOf(seed.accounts().getFirst().user().id());
    alexEmail = seed.accounts().getFirst().user().email();
  }

  /** Other tests load the same seed ids, so leave no demo accounts behind. */
  @AfterEach
  void tearDown() {
    demo.clear(seed);
  }

  @Test
  void resetRestoresTheDemoAccountsAndSignsVisitorsOut() {
    assertThat(reset(KEY)).isEqualTo(204);
    ResponseEntity<JsonNode> signedIn = signIn(alexEmail, DEMO_PASSWORD);
    assertThat(signedIn.getStatusCode().value()).isEqualTo(200);
    String token = signedIn.getBody().get("token").asString();
    long entries = count("mailbox_entries");
    long labels = count("labels");

    // A visitor gets new mail and deletes every label.
    data.received(users.findById(alex).orElseThrow(), "visitor@example.com", "Hi", Instant.now());
    jdbc.sql("delete from labels where user_id = :id").param("id", alex).update();
    assertThat(count("mailbox_entries")).isEqualTo(entries + 1);

    assertThat(reset(KEY)).isEqualTo(204);

    assertThat(count("mailbox_entries")).isEqualTo(entries);
    assertThat(count("labels")).isEqualTo(labels).isPositive();
    assertThat(api.as(token).get().uri("/me").retrieve().toBodilessEntity().getStatusCode().value())
        .isEqualTo(401);
    assertThat(signIn(alexEmail, DEMO_PASSWORD).getStatusCode().value()).isEqualTo(200);
  }

  @Test
  void resetNeedsTheKey() {
    assertThat(reset(null)).isEqualTo(401);
    assertThat(reset("not-the-key")).isEqualTo(401);
    assertThat(users.existsById(alex)).isFalse();
  }

  private int reset(String key) {
    return api.http()
        .post()
        .uri("/admin/demo/reset")
        .headers(
            headers -> {
              if (key != null) {
                headers.set(DemoController.KEY_HEADER, key);
              }
            })
        .retrieve()
        .toBodilessEntity()
        .getStatusCode()
        .value();
  }

  private ResponseEntity<JsonNode> signIn(String email, String password) {
    return api.http()
        .post()
        .uri("/auth/signin")
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", email, "password", password))
        .retrieve()
        .toEntity(JsonNode.class);
  }

  private long count(String table) {
    return jdbc.sql("select count(*) from " + table + " where user_id = :id")
        .param("id", alex)
        .query(Long.class)
        .single();
  }
}
