package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
class SendTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private DeliveryService delivery;

  private User ada;
  private User grace;
  private String adaToken;
  private String graceToken;

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    adaToken = signIn(ada);
    graceToken = signIn(grace);
  }

  @Test
  void deliversToMembersAndBouncesOutsiders() {
    String draftId = UUID.randomUUID().toString();
    Map<String, Object> draft = draft(draftId, List.of(grace.getEmail(), "bob@outside.example"));
    api.as(adaToken).put().uri("/drafts/" + draftId).body(draft).retrieve().toBodilessEntity();

    Instant before = Instant.now();
    JsonNode sent = send(adaToken, Map.of("draft", draft)).getBody();
    Instant sendAt = Instant.parse(sent.get("sendAt").asString());
    String thread = sent.get("threadId").asString();
    assertThat(sendAt).isBetween(before.plusSeconds(4), before.plusSeconds(6));
    assertThat(ids(adaToken, "outbox")).containsExactly(thread);
    assertThat(ids(graceToken, "inbox")).isEmpty();
    assertThat(
            api.as(adaToken)
                .get()
                .uri("/drafts/" + draftId)
                .retrieve()
                .toBodilessEntity()
                .getStatusCode()
                .value())
        .isEqualTo(404);

    UUID messageId = UUID.fromString(sent.get("messageId").asString());
    // The undo queue may already have delivered it on a slow runner; either way a repeat is a
    // no-op.
    delivery.deliver(messageId, sendAt);
    assertThat(delivery.deliver(messageId, sendAt)).isFalse();

    assertThat(ids(adaToken, "outbox")).isEmpty();
    assertThat(ids(adaToken, "sent")).containsExactly(thread);
    JsonNode graces = thread(graceToken, thread);
    assertThat(ids(graceToken, "inbox")).containsExactly(thread);
    assertThat(graces.get("isUnread").asBoolean()).isTrue();
    assertThat(graces.get("messages").get(0).get("bodyText").asString()).isEqualTo("Lunch & tea?");
    assertThat(graces.get("messages").get(0).get("status").asString()).isEqualTo("sent");

    // bob is outside the app and tests have no SMTP server, so Ada gets a bounce.
    assertThat(ids(adaToken, "inbox")).containsExactly(thread);
    JsonNode adas = thread(adaToken, thread).get("messages");
    assertThat(adas).hasSize(2);
    assertThat(adas.get(1).get("from").get("email").asString())
        .isEqualTo(DeliveryService.MAILER_DAEMON);
    assertThat(adas.get(1).get("bodyText").asString()).contains("bob@outside.example");
  }

  @Test
  void repliesThreadAndMutedThreadsSkipTheInbox() {
    JsonNode first =
        send(adaToken, Map.of("draft", draft(null, List.of(grace.getEmail())))).getBody();
    String thread = first.get("threadId").asString();
    deliver(first);
    api.as(graceToken)
        .patch()
        .uri("/threads")
        .body(Map.of("ids", List.of(thread), "op", Map.of("op", "mute")))
        .retrieve()
        .toBodilessEntity();

    Map<String, Object> reply = draft(null, List.of(grace.getEmail()));
    reply.put("mode", "reply");
    reply.put("threadId", thread);
    reply.put("inReplyTo", first.get("messageId").asString());
    JsonNode second = send(adaToken, Map.of("draft", reply)).getBody();
    assertThat(second.get("threadId").asString()).isEqualTo(thread);
    deliver(second);

    assertThat(ids(graceToken, "inbox")).isEmpty();
    JsonNode messages = thread(graceToken, thread).get("messages");
    assertThat(messages).hasSize(2);
    assertThat(messages.get(1).get("inReplyTo").asString())
        .isEqualTo(first.get("messageId").asString());
  }

  @Test
  void undoBringsTheDraftBack() {
    JsonNode sent =
        send(adaToken, Map.of("draft", draft(null, List.of(grace.getEmail())))).getBody();
    String messageId = sent.get("messageId").asString();

    ResponseEntity<JsonNode> undone = cancel(adaToken, messageId);
    assertThat(undone.getStatusCode().value()).isEqualTo(200);
    JsonNode draft = undone.getBody();
    assertThat(draft.get("subject").asString()).isEqualTo("Lunch");
    assertThat(draft.get("to").get(0).get("email").asString()).isEqualTo(grace.getEmail());
    assertThat(draft.get("threadId").isNull()).isTrue();
    assertThat(ids(adaToken, "outbox")).isEmpty();
    assertThat(
            api.as(adaToken)
                .get()
                .uri("/drafts/" + draft.get("id").asString())
                .retrieve()
                .toBodilessEntity()
                .getStatusCode()
                .value())
        .isEqualTo(200);
    assertThat(delivery.deliver(UUID.fromString(messageId), Instant.now().plusSeconds(60)))
        .isFalse();
    assertThat(cancel(adaToken, messageId).getStatusCode().value()).isEqualTo(404);

    JsonNode delivered =
        send(adaToken, Map.of("draft", draft(null, List.of(grace.getEmail())))).getBody();
    deliver(delivered);
    assertThat(cancel(adaToken, delivered.get("messageId").asString()).getStatusCode().value())
        .isEqualTo(409);
    assertThat(cancel(graceToken, delivered.get("messageId").asString()).getStatusCode().value())
        .isEqualTo(404);
  }

  @Test
  void scheduledMailWaitsInScheduled() {
    Instant later = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
    JsonNode sent =
        send(
                adaToken,
                Map.of("draft", draft(null, List.of(grace.getEmail())), "sendAt", later.toString()))
            .getBody();

    assertThat(Instant.parse(sent.get("sendAt").asString())).isEqualTo(later);
    assertThat(ids(adaToken, "scheduled")).containsExactly(sent.get("threadId").asString());
    UUID messageId = UUID.fromString(sent.get("messageId").asString());
    assertThat(delivery.deliver(messageId, Instant.now())).isFalse();
    assertThat(delivery.deliver(messageId, later)).isTrue();
    assertThat(ids(graceToken, "inbox")).containsExactly(sent.get("threadId").asString());
  }

  @Test
  void theUndoQueueDeliversAfterTheWindow() throws InterruptedException {
    String thread =
        send(adaToken, Map.of("draft", draft(null, List.of(grace.getEmail()))))
            .getBody()
            .get("threadId")
            .asString();
    Instant deadline = Instant.now().plusSeconds(15);
    while (ids(graceToken, "inbox").isEmpty() && Instant.now().isBefore(deadline)) {
      Thread.sleep(250);
    }
    assertThat(ids(graceToken, "inbox")).containsExactly(thread);
    assertThat(ids(adaToken, "sent")).containsExactly(thread);
  }

  @Test
  void rejectsADraftWithNoRecipients() {
    assertThat(send(adaToken, Map.of("draft", draft(null, List.of()))).getStatusCode().value())
        .isEqualTo(422);
    assertThat(send(adaToken, Map.of()).getStatusCode().value()).isEqualTo(422);
  }

  /** Delivers now instead of waiting out the undo window (the queue's later run is a no-op). */
  private void deliver(JsonNode sent) {
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));
  }

  private Map<String, Object> draft(String id, List<String> to) {
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", id != null ? id : UUID.randomUUID().toString());
    draft.put("mode", "new");
    draft.put("threadId", null);
    draft.put("inReplyTo", null);
    draft.put("to", to.stream().map(email -> Map.of("email", email)).toList());
    draft.put("cc", List.of());
    draft.put("bcc", List.of());
    draft.put("subject", "Lunch");
    draft.put("bodyHtml", "<p>Lunch &amp; tea?</p>");
    draft.put("attachments", List.of());
    draft.put("scheduledAt", null);
    draft.put("updatedAt", Instant.now().toString());
    return draft;
  }

  private ResponseEntity<JsonNode> send(String token, Map<String, Object> body) {
    return api.as(token).post().uri("/send").body(body).retrieve().toEntity(JsonNode.class);
  }

  private ResponseEntity<JsonNode> cancel(String token, String messageId) {
    return api.as(token).delete().uri("/send/" + messageId).retrieve().toEntity(JsonNode.class);
  }

  private JsonNode thread(String token, String id) {
    return api.as(token).get().uri("/threads/" + id).retrieve().body(JsonNode.class);
  }

  private List<String> ids(String token, String mailbox) {
    JsonNode body =
        api.as(token).get().uri("/threads?mailbox=" + mailbox).retrieve().body(JsonNode.class);
    List<String> ids = new ArrayList<>();
    body.get("items").forEach(item -> ids.add(item.get("id").asString()));
    return ids;
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
