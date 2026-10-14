package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class LabelTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;

  private User ada;
  private String token;

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    token =
        api.http()
            .post()
            .uri("/auth/signin")
            .body(Map.of("email", ada.getEmail(), "password", PASSWORD))
            .retrieve()
            .body(JsonNode.class)
            .get("token")
            .asString();
  }

  @Test
  void createsListsUpdatesAndDeletes() {
    JsonNode work = create(Map.of("name", "  Work ", "color", "lime")).getBody();
    String workId = work.get("id").asString();
    assertThat(work.get("name").asString()).isEqualTo("Work");
    assertThat(work.get("color").asString()).isEqualTo("lime");
    assertThat(work.get("parentId").isNull()).isTrue();

    String clientsId =
        create(Map.of("name", "Clients", "color", "cyan", "parentId", workId))
            .getBody()
            .get("id")
            .asString();
    assertThat(names()).containsExactly("Clients", "Work");

    JsonNode renamed = update(clientsId, Map.of("name", "Customers")).getBody();
    assertThat(renamed.get("name").asString()).isEqualTo("Customers");
    assertThat(renamed.get("parentId").asString()).isEqualTo(workId);
    Map<String, Object> toTop = new HashMap<>();
    toTop.put("parentId", null);
    assertThat(update(clientsId, toTop).getBody().get("parentId").isNull()).isTrue();
    update(clientsId, Map.of("parentId", workId));

    ResponseEntity<JsonNode> deleted =
        api.as(token).delete().uri("/labels/" + workId).retrieve().toEntity(JsonNode.class);
    assertThat(deleted.getStatusCode().value()).isEqualTo(200);
    assertThat(deleted.getBody().get("ok").asBoolean()).isTrue();
    JsonNode left = list();
    assertThat(left).hasSize(1);
    assertThat(left.get(0).get("parentId").isNull()).isTrue();
  }

  @Test
  void deletingALabelTakesItOffThreads() {
    String workId = create(Map.of("name", "Work", "color", "lime")).getBody().get("id").asString();
    String thread =
        data.received(ada, "grace@example.com", "Notes", Instant.now().minusSeconds(60))
            .getThreadId()
            .toString();
    api.as(token)
        .patch()
        .uri("/threads")
        .body(
            Map.of(
                "ids",
                List.of(thread),
                "op",
                Map.of("op", "addLabels", "labelIds", List.of(workId))))
        .retrieve()
        .toBodilessEntity();

    api.as(token).delete().uri("/labels/" + workId).retrieve().toBodilessEntity();

    JsonNode got = api.as(token).get().uri("/threads/" + thread).retrieve().body(JsonNode.class);
    assertThat(got.get("labelIds").isEmpty()).isTrue();
  }

  @Test
  void enforcesNamesNestingAndOwnership() {
    String workId = create(Map.of("name", "Work", "color", "lime")).getBody().get("id").asString();
    String childId =
        create(Map.of("name", "Clients", "color", "cyan", "parentId", workId))
            .getBody()
            .get("id")
            .asString();
    String foreign = data.label(data.user("Grace"), "Hers", LabelColor.CORAL).getId().toString();

    assertThat(create(Map.of("name", "work", "color", "violet")).getStatusCode().value())
        .isEqualTo(409);
    assertThat(
            create(Map.of("name", "Deep", "color", "violet", "parentId", childId))
                .getStatusCode()
                .value())
        .isEqualTo(422);
    assertThat(update(workId, Map.of("parentId", childId)).getStatusCode().value()).isEqualTo(422);
    assertThat(create(Map.of("name", " ", "color", "lime")).getStatusCode().value()).isEqualTo(422);
    assertThat(create(Map.of("name", "x".repeat(51), "color", "lime")).getStatusCode().value())
        .isEqualTo(422);
    assertThat(create(Map.of("name", "Pink", "color", "pink")).getStatusCode().value())
        .isEqualTo(422);
    assertThat(update(foreign, Map.of("name", "Mine")).getStatusCode().value()).isEqualTo(404);
    assertThat(
            api.as(token)
                .delete()
                .uri("/labels/" + UUID.randomUUID())
                .retrieve()
                .toEntity(JsonNode.class)
                .getStatusCode()
                .value())
        .isEqualTo(404);
  }

  private ResponseEntity<JsonNode> create(Map<String, Object> body) {
    return api.as(token).post().uri("/labels").body(body).retrieve().toEntity(JsonNode.class);
  }

  private ResponseEntity<JsonNode> update(String id, Map<String, Object> body) {
    return api.as(token)
        .patch()
        .uri("/labels/" + id)
        .body(body)
        .retrieve()
        .toEntity(JsonNode.class);
  }

  private JsonNode list() {
    return api.as(token).get().uri("/labels").retrieve().body(JsonNode.class);
  }

  private List<String> names() {
    List<String> names = new ArrayList<>();
    list().forEach(label -> names.add(label.get("name").asString()));
    return names;
  }
}
