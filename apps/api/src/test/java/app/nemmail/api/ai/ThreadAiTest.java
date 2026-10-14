package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.mail.Message;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.mail.MessageStatus;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class ThreadAiTest {

  private static final String PASSWORD = "babbage-cabbage";
  private static final String FROM = "lin@outside.example";
  private static final String PLAN =
      "The launch moves to March because the vendor needs more time. The vendor will ship the"
          + " final build in late February. Could you send the slides to the board by Friday?"
          + " The board meets on Monday to approve the launch plan.";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MessageRepository messages;
  @Autowired private MailboxEntryRepository entries;

  private User grace;
  private String token;

  @BeforeEach
  void setUp() {
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    token = signIn(grace);
  }

  @Test
  void summarizesWithTextRankAndActionItemsAndRedoesItForANewMessage() {
    MailboxEntry entry = data.received(grace, FROM, "Launch", PLAN, Instant.now());

    JsonNode summary = post("/ai/summary", entry.getThreadId());
    assertThat(summary.get("source").asString()).isEqualTo("model");
    assertThat(summary.get("value").get("text").asString()).isNotBlank();
    assertThat(summary.get("value").get("actionItems").get(0).asString())
        .isEqualTo(FROM + ": Could you send the slides to the board by Friday?");
    assertThat(summary.get("explanation").asString()).contains("of 4 sentences, on the server");
    // Cached: the same answer again.
    assertThat(post("/ai/summary", entry.getThreadId())).isEqualTo(summary);

    // Grace's own reply changes the thread, so the summary is made again and names her "You".
    reply(entry, grace.getEmail(), "I will send the slides to the board on Thursday morning.");
    JsonNode again = post("/ai/summary", entry.getThreadId());
    assertThat(again.get("explanation").asString()).contains("of 5 sentences");
  }

  @Test
  void aShortThreadGetsItsOpeningAsAHeuristicSummary() {
    MailboxEntry entry =
        data.received(grace, FROM, "Hi", "Are we still on for lunch today?", Instant.now());
    JsonNode summary = post("/ai/summary", entry.getThreadId());
    assertThat(summary.get("source").asString()).isEqualTo("heuristic");
    assertThat(summary.get("value").get("text").asString())
        .isEqualTo("Are we still on for lunch today?");
  }

  @Test
  void suggestsRepliesToTheLatestMessageFromSomeoneElse() {
    MailboxEntry entry =
        data.received(
            grace, FROM, "Lunch", "Are you free for lunch on Thursday at noon?", Instant.now());
    JsonNode replies = post("/ai/replies", entry.getThreadId());
    assertThat(replies.get("value")).hasSize(3);
    assertThat(replies.get("source").asString()).isEqualTo("heuristic");

    // A reply of her own does not change whom she would answer.
    reply(entry, grace.getEmail(), "Let me check my calendar.");
    assertThat(post("/ai/replies", entry.getThreadId()).get("value"))
        .isEqualTo(replies.get("value"));

    MailboxEntry bulk =
        data.received(grace, "no-reply@shop.example", "Your order", "It shipped.", Instant.now());
    JsonNode none = post("/ai/replies", bulk.getThreadId());
    assertThat(none.get("value")).isEmpty();
    assertThat(none.get("explanation").asString()).contains("no-reply");
  }

  @Test
  void checksAccessAndInput() {
    User ada = data.user("Ada");
    MailboxEntry adas = data.received(ada, FROM, "Launch", PLAN, Instant.now());
    assertThat(status("/ai/summary", Map.of("threadId", adas.getThreadId().toString())))
        .isEqualTo(404);
    assertThat(status("/ai/replies", Map.of("threadId", adas.getThreadId().toString())))
        .isEqualTo(404);
    assertThat(status("/ai/summary", Map.of())).isEqualTo(422);
    assertThat(
            api.http()
                .post()
                .uri("/ai/replies")
                .body(Map.of("threadId", adas.getThreadId().toString()))
                .exchange((request, response) -> response.getStatusCode())
                .value())
        .isEqualTo(401);
  }

  /** Adds a message to the thread in the user's copy, a second later than the first. */
  private void reply(MailboxEntry first, String from, String body) {
    Instant at = first.getLastMessageAt().plusSeconds(1);
    Message message =
        messages.save(
            new Message(
                UUID.randomUUID(),
                first.getThreadId(),
                from,
                null,
                "Re: thread",
                body,
                body,
                at,
                MessageStatus.SENT));
    entries.saveAndFlush(
        new MailboxEntry(
            UUID.randomUUID(),
            grace.getId(),
            message.getId(),
            first.getThreadId(),
            Mailbox.SENT,
            Category.PRIMARY,
            at));
  }

  private JsonNode post(String path, UUID threadId) {
    return api.as(token)
        .post()
        .uri(path)
        .body(Map.of("threadId", threadId.toString()))
        .retrieve()
        .body(JsonNode.class);
  }

  private int status(String path, Map<String, Object> body) {
    return api.as(token)
        .post()
        .uri(path)
        .body(body)
        .exchange((request, response) -> response.getStatusCode())
        .value();
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
