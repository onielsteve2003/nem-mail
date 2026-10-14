package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
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
class DraftTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;

  private User ada;
  private String token;

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    token = signIn(ada);
  }

  @Test
  void autosaveCreatesThenReplaces() {
    String id = UUID.randomUUID().toString();
    Map<String, Object> draft = draft(id, null);

    ResponseEntity<JsonNode> created = put(token, id, draft);
    assertThat(created.getStatusCode().value()).isEqualTo(200);
    JsonNode body = created.getBody();
    assertThat(body.get("subject").asString()).isEqualTo("Plans");
    assertThat(body.get("to").get(0).get("email").asString()).isEqualTo("grace@example.com");
    assertThat(body.get("cc").get(0).has("name")).isFalse();
    assertThat(body.get("threadId").isNull()).isTrue();
    Instant first = Instant.parse(body.get("updatedAt").asString());

    draft.put("subject", "Plans for Friday");
    JsonNode replaced = put(token, id, draft).getBody();
    assertThat(Instant.parse(replaced.get("updatedAt").asString())).isAfterOrEqualTo(first);

    String other = UUID.randomUUID().toString();
    put(token, other, draft(other, null));
    JsonNode list = api.as(token).get().uri("/drafts").retrieve().body(JsonNode.class);
    assertThat(list).hasSize(2);
    assertThat(list.get(0).get("id").asString()).isEqualTo(other);
    assertThat(get(token, id).getBody().get("subject").asString()).isEqualTo("Plans for Friday");

    ResponseEntity<JsonNode> deleted =
        api.as(token).delete().uri("/drafts/" + id).retrieve().toEntity(JsonNode.class);
    assertThat(deleted.getBody().get("ok").asBoolean()).isTrue();
    assertThat(get(token, id).getStatusCode().value()).isEqualTo(404);
  }

  @Test
  void aReplyDraftKeepsItsThread() {
    String thread =
        data.received(ada, "grace@example.com", "Notes", Instant.now().minusSeconds(60))
            .getThreadId()
            .toString();
    String id = UUID.randomUUID().toString();
    Map<String, Object> reply = draft(id, thread);
    reply.put("mode", "reply");

    assertThat(put(token, id, reply).getBody().get("threadId").asString()).isEqualTo(thread);
    Map<String, Object> stranger = draft(id, UUID.randomUUID().toString());
    assertThat(put(token, id, stranger).getStatusCode().value()).isEqualTo(422);
  }

  @Test
  void otherUsersDraftsAreOffLimits() {
    String id = UUID.randomUUID().toString();
    put(token, id, draft(id, null));
    User grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    String theirs = signIn(grace);

    assertThat(get(theirs, id).getStatusCode().value()).isEqualTo(404);
    assertThat(put(theirs, id, draft(id, null)).getStatusCode().value()).isEqualTo(403);
    assertThat(
            api.as(theirs)
                .delete()
                .uri("/drafts/" + id)
                .retrieve()
                .toEntity(JsonNode.class)
                .getStatusCode()
                .value())
        .isEqualTo(404);
    assertThat(get(token, id).getStatusCode().value()).isEqualTo(200);
  }

  @Test
  void rejectsBadDrafts() {
    String id = UUID.randomUUID().toString();
    assertThat(put(token, id, draft(UUID.randomUUID().toString(), null)).getStatusCode().value())
        .isEqualTo(422);
    Map<String, Object> mode = draft(id, null);
    mode.put("mode", "shout");
    assertThat(put(token, id, mode).getStatusCode().value()).isEqualTo(422);
    Map<String, Object> email = draft(id, null);
    email.put("to", List.of(Map.of("email", "not-an-address")));
    assertThat(put(token, id, email).getStatusCode().value()).isEqualTo(422);
    assertThat(put(token, "draft-1", draft("draft-1", null)).getStatusCode().value())
        .isEqualTo(400);
  }

  private Map<String, Object> draft(String id, String threadId) {
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", id);
    draft.put("mode", "new");
    draft.put("threadId", threadId);
    draft.put("inReplyTo", null);
    draft.put("to", List.of(Map.of("email", "grace@example.com", "name", "Grace")));
    draft.put("cc", List.of(Map.of("email", "alan@example.com")));
    draft.put("bcc", List.of());
    draft.put("subject", "Plans");
    draft.put("bodyHtml", "<p>Lunch?</p>");
    draft.put(
        "attachments",
        List.of(
            Map.of(
                "id", "att-1", "filename", "menu.pdf", "mime", "application/pdf", "size", 2048)));
    draft.put("scheduledAt", null);
    draft.put("updatedAt", Instant.now().toString());
    return draft;
  }

  private ResponseEntity<JsonNode> put(String as, String id, Map<String, Object> body) {
    return api.as(as).put().uri("/drafts/" + id).body(body).retrieve().toEntity(JsonNode.class);
  }

  private ResponseEntity<JsonNode> get(String as, String id) {
    return api.as(as).get().uri("/drafts/" + id).retrieve().toEntity(JsonNode.class);
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
