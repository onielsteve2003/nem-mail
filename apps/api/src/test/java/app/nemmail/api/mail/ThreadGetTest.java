package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
class ThreadGetTest {

  private static final String PASSWORD = "lovelace-notes";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailThreadRepository threads;
  @Autowired private MessageRepository messages;
  @Autowired private MessageRecipientRepository recipients;
  @Autowired private AttachmentRepository attachments;
  @Autowired private MailboxEntryRepository entries;

  private final Instant at = Instant.now().truncatedTo(ChronoUnit.MILLIS).minusSeconds(600);
  private User ada;
  private User grace;
  private MailThread thread;
  private Message question;
  private Message answer;

  /** Grace asks Ada; Ada answers with Carol on Bcc and a file attached. */
  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    thread = new MailThread(UUID.randomUUID(), "Engines", at);
    question = message(grace, "Does it compute?", at);
    answer = message(ada, "It weaves algebra.", at.plusSeconds(60));
    question.setAi("{\"summary\":null}");
    thread.addMessage(question.getSentAt());
    thread.addMessage(answer.getSentAt());
    threads.save(thread);
    messages.saveAll(List.of(question, answer));
    recipients.saveAll(
        List.of(
            recipient(question, ada, RecipientKind.TO),
            recipient(answer, grace, RecipientKind.TO),
            new MessageRecipient(
                UUID.randomUUID(),
                answer.getId(),
                "carol@example.com",
                "Carol",
                null,
                RecipientKind.BCC)));
    attachments.save(
        new Attachment(UUID.randomUUID(), answer.getId(), "notes.pdf", "application/pdf", 2048));
    entry(ada, question, Mailbox.INBOX, true);
    entry(ada, answer, Mailbox.SENT, true);
    entry(grace, question, Mailbox.SENT, true);
    entry(grace, answer, Mailbox.INBOX, false);
  }

  @Test
  void returnsTheSummaryAndMessagesOldestFirst() {
    ResponseEntity<JsonNode> response = get(ada, thread.getId().toString());

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    JsonNode body = response.getBody();
    assertThat(body.get("id").asString()).isEqualTo(thread.getId().toString());
    assertThat(body.get("messageCount").asInt()).isEqualTo(2);
    assertThat(body.get("mailboxes").toString()).isEqualTo("[\"inbox\",\"sent\"]");
    assertThat(body.get("isUnread").asBoolean()).isFalse();
    JsonNode first = body.get("messages").get(0);
    JsonNode second = body.get("messages").get(1);
    assertThat(first.get("subject").asString()).isEqualTo("Does it compute?");
    assertThat(first.get("from").get("name").asString()).isEqualTo("Grace");
    assertThat(first.get("to").get(0).get("email").asString()).isEqualTo(ada.getEmail());
    assertThat(first.get("ai").toString()).isEqualTo("{\"summary\":null}");
    assertThat(first.get("bodyHtml").isNull()).isTrue();
    assertThat(first.get("sendAt").isNull()).isTrue();
    assertThat(first.get("status").asString()).isEqualTo("sent");
    assertThat(second.has("ai")).isFalse();
    assertThat(second.get("bcc").get(0).get("email").asString()).isEqualTo("carol@example.com");
    assertThat(second.get("attachments").get(0).get("filename").asString()).isEqualTo("notes.pdf");
    assertThat(second.get("attachments").get(0).get("size").asInt()).isEqualTo(2048);
  }

  @Test
  void hidesTheSendersBccAndKeepsReadStatePerUser() {
    JsonNode body = get(grace, thread.getId().toString()).getBody();

    JsonNode answerForGrace = body.get("messages").get(1);
    assertThat(answerForGrace.get("bcc").isEmpty()).isTrue();
    assertThat(answerForGrace.get("isRead").asBoolean()).isFalse();
    assertThat(body.get("isUnread").asBoolean()).isTrue();
    assertThat(body.get("recipients").toString()).doesNotContain("carol@example.com");
  }

  @Test
  void anotherUsersThreadIsNotFound() {
    User carol = data.user("Carol", TestData.email("Carol"), passwords.encode(PASSWORD));

    ResponseEntity<JsonNode> response = get(carol, thread.getId().toString());

    assertThat(response.getStatusCode().value()).isEqualTo(404);
    assertThat(response.getBody().get("error").get("code").asString()).isEqualTo("NOT_FOUND");
    assertThat(get(ada, UUID.randomUUID().toString()).getStatusCode().value()).isEqualTo(404);
    assertThat(get(ada, "not-a-uuid").getStatusCode().value()).isEqualTo(400);
  }

  private Message message(User from, String subject, Instant sentAt) {
    Message message =
        new Message(
            UUID.randomUUID(),
            thread.getId(),
            from.getEmail(),
            from.getName(),
            subject,
            subject,
            subject,
            sentAt,
            MessageStatus.SENT);
    message.setFromUserId(from.getId());
    return message;
  }

  private static MessageRecipient recipient(Message message, User to, RecipientKind kind) {
    return new MessageRecipient(
        UUID.randomUUID(), message.getId(), to.getEmail(), to.getName(), to.getId(), kind);
  }

  private void entry(User owner, Message message, Mailbox mailbox, boolean isRead) {
    MailboxEntry entry =
        new MailboxEntry(
            UUID.randomUUID(),
            owner.getId(),
            message.getId(),
            thread.getId(),
            mailbox,
            Category.PRIMARY,
            thread.getLastMessageAt());
    entry.setRead(isRead);
    entries.saveAndFlush(entry);
  }

  private ResponseEntity<JsonNode> get(User user, String id) {
    String token =
        api.http()
            .post()
            .uri("/auth/signin")
            .body(Map.of("email", user.getEmail(), "password", PASSWORD))
            .retrieve()
            .body(JsonNode.class)
            .get("token")
            .asString();
    return api.as(token).get().uri("/threads/" + id).retrieve().toEntity(JsonNode.class);
  }
}
