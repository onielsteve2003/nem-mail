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
class ContactsSettingsCountsTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private DeliveryService delivery;

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
  void contactsAreCollectedAsMailIsDelivered() {
    send(List.of(grace.getEmail(), "bob@outside.example"));
    send(List.of(grace.getEmail()));

    JsonNode top = get(adaToken, "/contacts").getBody();
    assertThat(top).hasSize(2);
    assertThat(top.get(0).get("email").asString()).isEqualTo(grace.getEmail());
    assertThat(top.get(0).get("frequency").asInt()).isEqualTo(2);
    assertThat(top.get(1).get("email").asString()).isEqualTo("bob@outside.example");
    assertThat(top.get(1).has("name")).isFalse();
    assertThat(top.get(1).get("lastContactedAt").isNull()).isFalse();

    assertThat(get(adaToken, "/contacts?q=BOB").getBody()).hasSize(1);
    assertThat(get(adaToken, "/contacts?q=%25").getBody()).isEmpty();
    assertThat(get(adaToken, "/contacts?limit=1").getBody()).hasSize(1);
    assertThat(get(adaToken, "/contacts?limit=21").getStatusCode().value()).isEqualTo(422);

    JsonNode graces = get(graceToken, "/contacts").getBody();
    assertThat(graces).hasSize(1);
    assertThat(graces.get(0).get("email").asString()).isEqualTo(ada.getEmail());
    assertThat(graces.get(0).get("name").asString()).isEqualTo("Ada");
    assertThat(graces.get(0).get("frequency").asInt()).isEqualTo(2);
  }

  @Test
  void settingsDefaultAndSave() {
    JsonNode defaults = get(adaToken, "/settings").getBody();
    assertThat(defaults.get("theme").asString()).isEqualTo("dark");
    assertThat(defaults.get("ai")).hasSize(12);
    assertThat(defaults.get("ai").get("summary").asBoolean()).isTrue();
    assertThat(defaults.get("confirm").get("delete").asBoolean()).isTrue();
    assertThat(defaults.get("vacation").get("startsAt").isNull()).isTrue();

    JsonNode saved =
        put(Map.of(
                "theme",
                "light",
                "ai",
                Map.of("summary", false, "bogus", false),
                "swipe",
                Map.of("right", "snooze"),
                "unknown",
                1))
            .getBody();
    assertThat(saved.get("theme").asString()).isEqualTo("light");
    assertThat(saved.get("ai").get("summary").asBoolean()).isFalse();
    assertThat(saved.get("ai").get("spam").asBoolean()).isTrue();
    assertThat(saved.get("ai").has("bogus")).isFalse();
    assertThat(saved.get("swipe").get("left").asString()).isEqualTo("archive");
    assertThat(saved.get("swipe").get("right").asString()).isEqualTo("snooze");
    assertThat(saved.has("unknown")).isFalse();
    assertThat(get(adaToken, "/settings").getBody()).isEqualTo(saved);
    assertThat(get(graceToken, "/settings").getBody().get("theme").asString()).isEqualTo("dark");

    assertThat(put(Map.of("theme", "neon")).getStatusCode().value()).isEqualTo(422);
    assertThat(put(Map.of("signature", "x".repeat(2001))).getStatusCode().value()).isEqualTo(422);
    assertThat(get(adaToken, "/settings").getBody()).isEqualTo(saved);
  }

  @Test
  void countsFollowTheListViews() {
    UUID work = data.label(ada, "Work", LabelColor.LIME).getId();
    MailboxEntry unread = data.received(ada, "x@example.com", "Unread", now.minusSeconds(50));
    unread.getLabelIds().add(work);
    entries.saveAndFlush(unread);
    MailboxEntry read = data.received(ada, "x@example.com", "Read", now.minusSeconds(40));
    read.setRead(true);
    entries.saveAndFlush(read);
    MailboxEntry trashed = data.received(ada, "x@example.com", "Trashed", now.minusSeconds(30));
    trashed.setMailbox(Mailbox.TRASH);
    trashed.getLabelIds().add(work);
    entries.saveAndFlush(trashed);
    MailboxEntry snoozed = data.received(ada, "x@example.com", "Snoozed", now.minusSeconds(20));
    snoozed.setSnoozedUntil(now.plusSeconds(3600));
    snoozed.setCategory(Category.SOCIAL);
    snoozed.setStarred(true);
    entries.saveAndFlush(snoozed);
    String draftId = UUID.randomUUID().toString();
    api.as(adaToken)
        .put()
        .uri("/drafts/" + draftId)
        .body(draft(draftId, List.of()))
        .retrieve()
        .toBodilessEntity();

    JsonNode counts = get(adaToken, "/counts").getBody();
    JsonNode mailboxes = counts.get("mailboxes");
    assertThat(mailboxes).hasSize(11);
    assertThat(mailboxes.get("inbox").asInt()).isEqualTo(1);
    assertThat(mailboxes.get("snoozed").asInt()).isEqualTo(1);
    assertThat(mailboxes.get("starred").asInt()).isEqualTo(1);
    assertThat(mailboxes.get("trash").asInt()).isEqualTo(1);
    assertThat(mailboxes.get("all").asInt()).isEqualTo(2);
    assertThat(mailboxes.get("drafts").asInt()).isEqualTo(1);
    assertThat(mailboxes.get("sent").asInt()).isZero();
    // The snoozed thread is out of the inbox, so only the unread Primary one counts.
    assertThat(counts.get("categories").toString()).isEqualTo("{\"primary\":1}");
    assertThat(counts.get("labels").toString()).isEqualTo("{\"" + work + "\":1}");
  }

  private void send(List<String> to) {
    JsonNode sent =
        api.as(adaToken)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft(UUID.randomUUID().toString(), to)))
            .retrieve()
            .body(JsonNode.class);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));
  }

  private static Map<String, Object> draft(String id, List<String> to) {
    return Map.of(
        "id", id,
        "mode", "new",
        "to", to.stream().map(email -> Map.of("email", email)).toList(),
        "cc", List.of(),
        "bcc", List.of(),
        "subject", "Hello",
        "bodyHtml", "<p>Hi</p>",
        "attachments", List.of(),
        "updatedAt", Instant.now().toString());
  }

  private ResponseEntity<JsonNode> put(Map<String, Object> body) {
    return api.as(adaToken).put().uri("/settings").body(body).retrieve().toEntity(JsonNode.class);
  }

  private ResponseEntity<JsonNode> get(String token, String uri) {
    return api.as(token).get().uri(uri).retrieve().toEntity(JsonNode.class);
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
