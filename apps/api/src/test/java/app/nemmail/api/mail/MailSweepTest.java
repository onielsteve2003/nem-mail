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
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class MailSweepTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private MailSweeper sweeper;

  private final Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
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
  void deliversDueScheduledMail() {
    JsonNode sent =
        api.as(adaToken)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft(grace.getEmail()), "sendAt", now.toString()))
            .retrieve()
            .body(JsonNode.class);
    String thread = sent.get("threadId").asString();

    sweeper.sweep(Instant.now());

    assertThat(ids(adaToken, "scheduled")).isEmpty();
    assertThat(ids(adaToken, "sent")).containsExactly(thread);
    assertThat(ids(graceToken, "inbox")).containsExactly(thread);
  }

  @Test
  void wakesDueSnoozesUnreadInTheInbox() {
    MailboxEntry due = snoozed("Due", now.minusSeconds(60), Mailbox.INBOX);
    MailboxEntry later = snoozed("Later", now.plusSeconds(3600), Mailbox.INBOX);
    MailboxEntry trashed = snoozed("Trashed", now.minusSeconds(60), Mailbox.TRASH);

    sweeper.sweep(now);

    JsonNode woke = thread(due);
    assertThat(woke.get("snoozedUntil").isNull()).isTrue();
    assertThat(woke.get("isUnread").asBoolean()).isTrue();
    assertThat(ids(adaToken, "inbox")).containsExactly(due.getThreadId().toString());
    assertThat(ids(adaToken, "snoozed")).containsExactly(later.getThreadId().toString());
    // Trashed while snoozed: the snooze ends quietly and the thread stays read in Trash.
    JsonNode binned = thread(trashed);
    assertThat(binned.get("snoozedUntil").isNull()).isTrue();
    assertThat(binned.get("isUnread").asBoolean()).isFalse();
    assertThat(ids(adaToken, "trash")).containsExactly(trashed.getThreadId().toString());
  }

  @Test
  void theFirstRequestAfterAGapSweepsBeforeAnswering() {
    MailboxEntry due = snoozed("Due", now.minusSeconds(60), Mailbox.INBOX);
    sweeper.lastSweep.set(Instant.EPOCH);

    JsonNode inbox =
        api.as(adaToken).get().uri("/threads?mailbox=inbox").retrieve().body(JsonNode.class);

    assertThat(inbox.get("items").get(0).get("id").asString())
        .isEqualTo(due.getThreadId().toString());
    assertThat(inbox.get("items").get(0).get("isUnread").asBoolean()).isTrue();
    assertThat(sweeper.lastSweep.get()).isAfter(now.minusSeconds(1));
  }

  private MailboxEntry snoozed(String subject, Instant until, Mailbox mailbox) {
    MailboxEntry entry = data.received(ada, "grace@example.com", subject, now.minusSeconds(600));
    entry.setRead(true);
    entry.setMailbox(mailbox);
    entry.setSnoozedUntil(until);
    return entries.saveAndFlush(entry);
  }

  private JsonNode thread(MailboxEntry entry) {
    return api.as(adaToken)
        .get()
        .uri("/threads/" + entry.getThreadId())
        .retrieve()
        .body(JsonNode.class);
  }

  private static Map<String, Object> draft(String to) {
    return Map.ofEntries(
        Map.entry("id", UUID.randomUUID().toString()),
        Map.entry("mode", "new"),
        Map.entry("to", List.of(Map.of("email", to))),
        Map.entry("cc", List.of()),
        Map.entry("bcc", List.of()),
        Map.entry("subject", "Later"),
        Map.entry("bodyHtml", "<p>Hello</p>"),
        Map.entry("attachments", List.of()),
        Map.entry("updatedAt", Instant.now().toString()));
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
