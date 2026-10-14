package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class ThreadListTest {

  private static final String PASSWORD = "analytical-engine";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailboxEntryRepository entries;

  private final Instant base = Instant.now().truncatedTo(ChronoUnit.MILLIS).minusSeconds(3600);
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
  void eachViewFollowsTheSharedMailboxRules() {
    Label work = data.label(ada, "Work", LabelColor.VIOLET);
    MailboxEntry inbox = mail("Inbox", 1, e -> {});
    MailboxEntry archived = mail("Archived", 2, e -> e.setMailbox(null));
    MailboxEntry spam = mail("Spam", 3, e -> e.setMailbox(Mailbox.SPAM));
    MailboxEntry snoozed =
        mail("Snoozed", 4, e -> e.setSnoozedUntil(base.plus(Duration.ofDays(1))));
    MailboxEntry starred =
        mail(
            "Starred",
            5,
            e -> {
              e.setStarred(true);
              e.setCategory(Category.SOCIAL);
              e.getLabelIds().add(work.getId());
            });
    MailboxEntry starredSpam =
        mail(
            "Starred spam",
            6,
            e -> {
              e.setStarred(true);
              e.setMailbox(Mailbox.SPAM);
            });
    data.received(data.user("Grace"), "x@example.com", "Someone else's", base.plusSeconds(9));

    assertThat(ids("mailbox=inbox")).containsExactly(id(starred), id(inbox));
    assertThat(ids("mailbox=inbox&category=social")).containsExactly(id(starred));
    assertThat(ids("mailbox=all"))
        .containsExactly(id(starred), id(snoozed), id(archived), id(inbox));
    assertThat(ids("mailbox=spam")).containsExactly(id(starredSpam), id(spam));
    assertThat(ids("mailbox=starred")).containsExactly(id(starred));
    assertThat(ids("mailbox=snoozed")).containsExactly(id(snoozed));
    assertThat(ids("mailbox=trash")).isEmpty();
    assertThat(ids("label=" + work.getId())).containsExactly(id(starred));
  }

  @Test
  void summariesFoldTheEntriesIntoTheSharedShape() {
    mail("Hello", 1, e -> e.setRead(true));

    JsonNode row = list("mailbox=inbox").getBody().get("items").get(0);

    assertThat(row.get("subject").asString()).isEqualTo("Hello");
    assertThat(row.get("snippet").asString()).isEqualTo("About Hello.");
    assertThat(row.get("participants").get(0).get("email").asString()).isEqualTo("ada@example.com");
    assertThat(row.get("participants").get(0).has("name")).isFalse();
    assertThat(row.get("messageCount").asInt()).isEqualTo(1);
    assertThat(Instant.parse(row.get("lastMessageAt").asString())).isEqualTo(base.plusSeconds(1));
    assertThat(row.get("mailboxes").get(0).asString()).isEqualTo("inbox");
    assertThat(row.get("category").asString()).isEqualTo("primary");
    assertThat(row.get("isUnread").asBoolean()).isFalse();
    assertThat(row.get("isStarred").asBoolean()).isFalse();
    assertThat(row.get("snoozedUntil").isNull()).isTrue();
    assertThat(row.get("labelIds").isEmpty()).isTrue();
    assertThat(row.has("ai")).isFalse();
  }

  @Test
  void pagesWithAnOpaqueCursorAndBreaksTimeTiesById() {
    List<String> made = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      // Two pairs share a time, so the id has to keep the order stable.
      made.add(id(mail("Page " + i, i / 2, e -> {})));
    }

    List<String> seen = new ArrayList<>();
    String cursor = null;
    int pages = 0;
    do {
      JsonNode body =
          list("mailbox=inbox&limit=2" + (cursor == null ? "" : "&cursor=" + cursor)).getBody();
      body.get("items").forEach(item -> seen.add(item.get("id").asString()));
      cursor = body.get("nextCursor").isNull() ? null : body.get("nextCursor").asString();
      pages++;
    } while (cursor != null);

    assertThat(pages).isEqualTo(3);
    assertThat(seen).containsExactlyInAnyOrderElementsOf(made).doesNotHaveDuplicates();
    assertThat(seen.getFirst()).isEqualTo(made.getLast());
  }

  @Test
  void rejectsBadQueries() {
    assertThat(status("")).isEqualTo(422);
    assertThat(status("?mailbox=inbox&label=" + java.util.UUID.randomUUID())).isEqualTo(422);
    assertThat(status("?mailbox=archive")).isEqualTo(422);
    assertThat(status("?mailbox=inbox&category=news")).isEqualTo(422);
    assertThat(status("?mailbox=inbox&limit=101")).isEqualTo(422);
    assertThat(status("?mailbox=inbox&cursor=not-a-cursor")).isEqualTo(400);
    assertThat(
            api.http()
                .get()
                .uri("/threads?mailbox=inbox")
                .retrieve()
                .toBodilessEntity()
                .getStatusCode()
                .value())
        .isEqualTo(401);
  }

  /** A one-message inbox thread for Ada at {@code base + seconds}, then adjusted. */
  private MailboxEntry mail(String subject, int seconds, Consumer<MailboxEntry> change) {
    MailboxEntry entry = data.received(ada, "ada@example.com", subject, base.plusSeconds(seconds));
    change.accept(entry);
    return entries.saveAndFlush(entry);
  }

  private static String id(MailboxEntry entry) {
    return entry.getThreadId().toString();
  }

  private ResponseEntity<JsonNode> list(String query) {
    return api.as(token).get().uri("/threads?" + query).retrieve().toEntity(JsonNode.class);
  }

  private List<String> ids(String query) {
    ResponseEntity<JsonNode> response = list(query);
    assertThat(response.getStatusCode().value()).isEqualTo(200);
    List<String> ids = new ArrayList<>();
    response.getBody().get("items").forEach(item -> ids.add(item.get("id").asString()));
    return ids;
  }

  private int status(String query) {
    return api.as(token)
        .get()
        .uri("/threads" + query)
        .retrieve()
        .toBodilessEntity()
        .getStatusCode()
        .value();
  }
}
