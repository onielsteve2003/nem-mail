package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.mail.MessageRecipient;
import app.nemmail.api.mail.MessageRecipientRepository;
import app.nemmail.api.mail.RecipientKind;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class AssistantTest {

  private static final String PASSWORD = "babbage-cabbage";
  private static final String LIN = "lin@outside.example";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private MessageRecipientRepository recipients;

  private User grace;
  private String token;

  @BeforeEach
  void setUp() {
    grace = data.user("Grace Hopper", TestData.email("Grace"), passwords.encode(PASSWORD));
    token = signIn(grace);
  }

  @Test
  void summarizesUnreadByTabWithTheThreadsItDrewOn() {
    MailboxEntry lunch = direct("Lunch", "Are you free for lunch on Thursday at noon?");
    MailboxEntry sale = data.received(grace, "deals@shop.example", "Sale", Instant.now());
    sale.setCategory(Category.PROMOTIONS);
    entries.saveAndFlush(sale);
    MailboxEntry read = data.received(grace, LIN, "Old news", Instant.now());
    read.setRead(true);
    entries.saveAndFlush(read);

    JsonNode answer = ask("Summarize my unread", null);
    String text = answer.get("text").asString();
    assertThat(text)
        .startsWith(
            "You have 2 unread conversations: 1 in Primary and 1 in Promotions. The ones that"
                + " look most important:");
    assertThat(text).contains("• lin@outside.example · Lunch — Are you free for lunch");
    assertThat(answer.get("threadIds").valueStream().map(JsonNode::asString))
        .containsExactlyInAnyOrder(lunch.getThreadId().toString(), sale.getThreadId().toString());
  }

  @Test
  void listsWhatNeedsAReplyAndDraftsOne() {
    MailboxEntry lunch = direct("Lunch", "Are you free for lunch on Thursday at noon?");
    // Not addressed to her directly, and an old one: neither is waiting on her.
    data.received(grace, LIN, "Notes", "What do you think?", Instant.now());
    direct("Last month", "Can you send the report?", Instant.now().minus(30, ChronoUnit.DAYS));

    JsonNode waiting = ask("What needs a reply?", null);
    assertThat(waiting.get("text").asString())
        .startsWith("One conversation looks like it needs a reply:\n• lin@outside.example · Lunch");
    assertThat(waiting.get("threadIds")).hasSize(1);

    JsonNode draft = ask("Draft a reply", null);
    assertThat(draft.get("text").asString())
        .startsWith("Here is a draft reply to lin@outside.example about “Lunch”:\n\nHi,\n\n")
        .endsWith("\n\nBest,\nGrace");
    assertThat(draft.get("threadIds").get(0).asString()).isEqualTo(lunch.getThreadId().toString());
    // "Thursday at noon" is a date chip.
    assertThat(draft.get("extractions").get(0).get("kind").asString()).isIn("date", "meeting");
  }

  @Test
  void draftsForTheOpenThreadAndHelpsWithAnythingElse() {
    MailboxEntry notes =
        data.received(grace, LIN, "Notes", "Can you review the notes?", Instant.now());
    JsonNode draft = ask("Reply to this", notes.getThreadId());
    assertThat(draft.get("text").asString()).contains("about “Notes”");

    JsonNode help = ask("What is the weather?", null);
    assertThat(help.get("text").asString()).isEqualTo(Assistant.HELP);
    assertThat(help.get("threadIds")).isEmpty();

    JsonNode empty = ask("Summarize my unread", null);
    assertThat(empty.get("text").asString())
        .startsWith("You have 1 unread conversation in Primary.");
  }

  @Test
  void checksAccessAndInput() {
    User ada = data.user("Ada");
    MailboxEntry adas = data.received(ada, LIN, "Launch", Instant.now());
    assertThat(status(Map.of("prompt", "Draft a reply", "threadId", adas.getThreadId().toString())))
        .isEqualTo(404);
    assertThat(status(Map.of("prompt", " "))).isEqualTo(422);
    assertThat(status(Map.of("prompt", "x".repeat(2001)))).isEqualTo(422);
    assertThat(
            api.http()
                .post()
                .uri("/ai/assistant")
                .body(Map.of("prompt", "Summarize my unread"))
                .exchange((request, response) -> response.getStatusCode())
                .value())
        .isEqualTo(401);
  }

  private MailboxEntry direct(String subject, String body) {
    return direct(subject, body, Instant.now());
  }

  /** Mail from Lin with Grace on the To line. */
  private MailboxEntry direct(String subject, String body, Instant at) {
    MailboxEntry entry = data.received(grace, LIN, subject, body, at);
    recipients.saveAndFlush(
        new MessageRecipient(
            UUID.randomUUID(),
            entry.getMessageId(),
            grace.getEmail(),
            grace.getName(),
            grace.getId(),
            RecipientKind.TO));
    return entry;
  }

  private JsonNode ask(String prompt, UUID threadId) {
    Map<String, Object> body = new HashMap<>();
    body.put("prompt", prompt);
    if (threadId != null) {
      body.put("threadId", threadId.toString());
    }
    return api.as(token).post().uri("/ai/assistant").body(body).retrieve().body(JsonNode.class);
  }

  private int status(Map<String, Object> body) {
    return api.as(token)
        .post()
        .uri("/ai/assistant")
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
