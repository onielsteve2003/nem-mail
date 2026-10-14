package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
class ThreadOpsTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MessageRepository messages;
  @Autowired private MailboxEntryRepository entries;

  private final Instant at = Instant.now().truncatedTo(ChronoUnit.MILLIS).minusSeconds(600);
  private User ada;
  private String token;
  private String thread;

  /** A thread Grace started and Ada answered: Ada's entries are Inbox and Sent. */
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
    MailboxEntry received = data.received(ada, "grace@example.com", "Notes", at);
    received.setRead(true);
    entries.saveAndFlush(received);
    Message reply =
        new Message(
            UUID.randomUUID(),
            received.getThreadId(),
            ada.getEmail(),
            "Ada",
            "Re: Notes",
            "Yes",
            "Yes",
            at.plusSeconds(30),
            MessageStatus.SENT);
    reply.setFromUserId(ada.getId());
    messages.save(reply);
    MailboxEntry sent =
        new MailboxEntry(
            UUID.randomUUID(),
            ada.getId(),
            reply.getId(),
            received.getThreadId(),
            Mailbox.SENT,
            Category.PRIMARY,
            at);
    sent.setRead(true);
    entries.saveAndFlush(sent);
    thread = received.getThreadId().toString();
  }

  @Test
  void flagsApplyToTheThreadAndUnknownIdsAreSkipped() {
    String stranger =
        data.received(data.user("Grace"), "x@example.com", "Not Ada's", at)
            .getThreadId()
            .toString();

    ResponseEntity<JsonNode> starred =
        patch(List.of(thread, stranger, UUID.randomUUID().toString()), Map.of("op", "star"));

    assertThat(starred.getStatusCode().value()).isEqualTo(200);
    assertThat(starred.getBody().get("updatedIds").toString()).isEqualTo("[\"" + thread + "\"]");
    assertThat(ids("starred")).containsExactly(thread);
    op(Map.of("op", "markImportant"));
    assertThat(ids("important")).containsExactly(thread);
    op(Map.of("op", "markUnread"));
    JsonNode messagesNow = get().get("messages");
    assertThat(messagesNow.get(0).get("isRead").asBoolean()).isTrue();
    assertThat(messagesNow.get(1).get("isRead").asBoolean()).isFalse();
    op(Map.of("op", "markRead"));
    assertThat(get().get("isUnread").asBoolean()).isFalse();
    op(Map.of("op", "unstar"));
    assertThat(ids("starred")).isEmpty();
  }

  @Test
  void movesKeepTheUsersOwnMessagesInSent() {
    op(Map.of("op", "archive"));
    assertThat(ids("inbox")).isEmpty();
    assertThat(ids("all")).containsExactly(thread);
    assertThat(mailboxes()).isEqualTo("[\"sent\"]");

    op(Map.of("op", "trash"));
    assertThat(ids("trash")).containsExactly(thread);
    assertThat(ids("all")).isEmpty();
    assertThat(ids("sent")).isEmpty();
    assertThat(mailboxes()).isEqualTo("[\"sent\",\"trash\"]");

    op(Map.of("op", "move", "to", "inbox"));
    assertThat(mailboxes()).isEqualTo("[\"inbox\",\"sent\"]");
    op(Map.of("op", "spam"));
    assertThat(ids("spam")).containsExactly(thread);
    op(Map.of("op", "notSpam"));
    assertThat(ids("inbox")).containsExactly(thread);
    assertThat(ids("sent")).containsExactly(thread);
  }

  @Test
  void muteArchivesAndSnoozeWakesInTheInbox() {
    op(Map.of("op", "mute"));
    assertThat(get().get("isMuted").asBoolean()).isTrue();
    assertThat(ids("inbox")).isEmpty();

    String until =
        Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString();
    op(Map.of("op", "snooze", "until", until));
    assertThat(ids("snoozed")).containsExactly(thread);
    assertThat(ids("inbox")).isEmpty();
    assertThat(Instant.parse(get().get("snoozedUntil").asString())).isEqualTo(Instant.parse(until));

    op(Map.of("op", "unsnooze"));
    op(Map.of("op", "unmute"));
    assertThat(ids("inbox")).containsExactly(thread);
    assertThat(get().get("isMuted").asBoolean()).isFalse();
  }

  @Test
  void labelsAndTabs() {
    String work = data.label(ada, "Work", LabelColor.LIME).getId().toString();
    String foreign = data.label(data.user("Grace"), "Hers", LabelColor.CORAL).getId().toString();

    op(Map.of("op", "addLabels", "labelIds", List.of(work)));
    assertThat(get().get("labelIds").toString()).isEqualTo("[\"" + work + "\"]");
    assertThat(
            patch(List.of(thread), Map.of("op", "addLabels", "labelIds", List.of(foreign)))
                .getStatusCode()
                .value())
        .isEqualTo(422);
    op(Map.of("op", "removeLabels", "labelIds", List.of(work)));
    assertThat(get().get("labelIds").isEmpty()).isTrue();

    op(Map.of("op", "setCategory", "category", "updates"));
    assertThat(ids("inbox&category=updates")).containsExactly(thread);
    assertThat(ids("inbox&category=primary")).isEmpty();
  }

  @Test
  void rejectsBadRequests() {
    assertThat(status(List.of(), Map.of("op", "star"))).isEqualTo(422);
    assertThat(status(List.of(thread), Map.of("op", "move", "to", "sent"))).isEqualTo(422);
    assertThat(status(List.of(thread), Map.of("op", "setCategory", "category", "news")))
        .isEqualTo(422);
    assertThat(status(List.of(thread), Map.of("op", "addLabels", "labelIds", List.of())))
        .isEqualTo(422);
    assertThat(status(List.of(thread), Map.of("op", "explode"))).isEqualTo(400);
    assertThat(status(List.of(thread), Map.of("op", "snooze", "until", "tomorrow"))).isEqualTo(400);
  }

  private void op(Map<String, Object> op) {
    ResponseEntity<JsonNode> response = patch(List.of(thread), op);
    assertThat(response.getStatusCode().value()).as("%s", op).isEqualTo(200);
  }

  private ResponseEntity<JsonNode> patch(List<String> ids, Map<String, Object> op) {
    return api.as(token)
        .patch()
        .uri("/threads")
        .body(Map.of("ids", ids, "op", op))
        .retrieve()
        .toEntity(JsonNode.class);
  }

  private int status(List<String> ids, Map<String, Object> op) {
    return patch(ids, op).getStatusCode().value();
  }

  private JsonNode get() {
    return api.as(token).get().uri("/threads/" + thread).retrieve().body(JsonNode.class);
  }

  private String mailboxes() {
    return get().get("mailboxes").toString();
  }

  private List<String> ids(String mailbox) {
    JsonNode body =
        api.as(token).get().uri("/threads?mailbox=" + mailbox).retrieve().body(JsonNode.class);
    List<String> ids = new ArrayList<>();
    body.get("items").forEach(item -> ids.add(item.get("id").asString()));
    return ids;
  }
}
