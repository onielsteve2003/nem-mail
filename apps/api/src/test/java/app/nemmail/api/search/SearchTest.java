package app.nemmail.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.DeliveryService;
import app.nemmail.api.mail.Label;
import app.nemmail.api.mail.LabelColor;
import app.nemmail.api.mail.LabelRepository;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
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
class SearchTest {

  private static final String PASSWORD = "analytical-engine";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private LabelRepository labels;
  @Autowired private DeliveryService delivery;

  private final Instant base = Instant.now().truncatedTo(ChronoUnit.MILLIS).minusSeconds(3600);
  private User ada;
  private String token;

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    token = signIn(ada);
  }

  @Test
  void matchesWordsAndOperatorsAndLeavesOutSpamAndOtherUsers() {
    MailboxEntry budget =
        data.received(
            ada,
            "grace@example.com",
            "Quarterly numbers",
            "Hello Ada. Before Friday, please look over the budget figures for the next quarter"
                + " and send me your notes.",
            base.plusSeconds(1));
    MailboxEntry lunch =
        data.received(ada, "alan@example.com", "Lunch", "Pizza on Friday?", base.plusSeconds(2));
    lunch.setRead(true);
    entries.saveAndFlush(lunch);
    MailboxEntry spam =
        data.received(ada, "x@example.com", "Budget offer", "Cheap budget", base.plusSeconds(3));
    spam.setMailbox(Mailbox.SPAM);
    entries.saveAndFlush(spam);
    data.received(data.user("Grace"), "x@example.com", "Budget", "budget", base.plusSeconds(4));

    assertThat(ids("budget")).containsExactly(id(budget));
    assertThat(ids("budgets")).containsExactly(id(budget));
    assertThat(ids("friday -budget")).containsExactly(id(lunch));
    assertThat(ids("from:grace")).containsExactly(id(budget));
    assertThat(ids("subject:lunch")).containsExactly(id(lunch));
    assertThat(ids("is:unread")).containsExactly(id(budget));
    assertThat(ids("is:read")).containsExactly(id(lunch));
    assertThat(ids("has:attachment")).isEmpty();
    assertThat(ids("\"budget figures\"")).containsExactly(id(budget));
    assertThat(ids("\"figures budget\"")).isEmpty();
  }

  @Test
  void excerptsTheMatchAndPagesByRank() {
    data.received(
        ada,
        "grace@example.com",
        "Notes",
        "Opening words that say nothing at all about the topic, then more filler text, and more"
            + " still, until finally the compiler is mentioned near the end of this body.",
        base.plusSeconds(1));
    MailboxEntry inSubject =
        data.received(ada, "alan@example.com", "Compiler release", "Ships soon.", base);

    JsonNode first = search("compiler", "&limit=1");
    JsonNode row = first.get("items").get(0);
    assertThat(row.get("id").asString()).isEqualTo(id(inSubject));

    List<String> seen = new ArrayList<>();
    seen.add(row.get("id").asString());
    JsonNode second = search("compiler", "&limit=1&cursor=" + first.get("nextCursor").asString());
    String excerpt = second.get("items").get(0).get("snippet").asString();
    assertThat(excerpt).contains("compiler").doesNotStartWith("Opening").doesNotContain("<b>");
    assertThat(second.get("nextCursor").isNull()).isTrue();
    seen.add(second.get("items").get(0).get("id").asString());
    assertThat(seen).doesNotHaveDuplicates();
  }

  @Test
  void matchesLabelsByNameOrPathAndDatesByDayAndLeavesOutTrash() {
    Label projects = data.label(ada, "Projects", LabelColor.VIOLET);
    Label plans =
        labels.saveAndFlush(
            new Label(
                UUID.randomUUID(), ada.getId(), "Big plans", LabelColor.LIME, projects.getId()));
    MailboxEntry march =
        data.received(ada, "grace@example.com", "Report", Instant.parse("2025-03-10T12:00:00Z"));
    march.getLabelIds().add(plans.getId());
    entries.saveAndFlush(march);
    MailboxEntry june =
        data.received(ada, "grace@example.com", "Report", Instant.parse("2025-06-01T00:00:00Z"));
    MailboxEntry trashed =
        data.received(ada, "grace@example.com", "Report", Instant.parse("2025-04-01T12:00:00Z"));
    trashed.getLabelIds().add(plans.getId());
    trashed.setMailbox(Mailbox.TRASH);
    entries.saveAndFlush(trashed);

    assertThat(ids("label:big-plans")).containsExactly(id(march));
    assertThat(ids("label:\"big plans\"")).containsExactly(id(march));
    assertThat(ids("label:projects/big-plans")).containsExactly(id(march));
    assertThat(ids("label:projects")).isEmpty();
    assertThat(ids("report -label:big-plans")).containsExactly(id(june));
    // before: is exclusive and after: inclusive of the day's start (UTC).
    assertThat(ids("subject:report before:2025-06-01")).containsExactly(id(march));
    assertThat(ids("subject:report after:2025-06-01")).containsExactly(id(june));
    assertThat(ids("subject:report after:2025-03-01 before:2025-03-11")).containsExactly(id(march));
  }

  @Test
  void matchesRecipientsButHidesBccFromEveryoneButTheSender() {
    User grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    User eve = data.user("Eve", TestData.email("Eve"), passwords.encode(PASSWORD));
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", UUID.randomUUID().toString());
    draft.put("mode", "new");
    draft.put("threadId", null);
    draft.put("inReplyTo", null);
    draft.put("to", List.of(Map.of("email", grace.getEmail())));
    draft.put("cc", List.of());
    draft.put("bcc", List.of(Map.of("email", eve.getEmail())));
    draft.put("subject", "Engine");
    draft.put("bodyHtml", "<p>Gears.</p>");
    draft.put("attachments", List.of());
    draft.put("scheduledAt", null);
    draft.put("updatedAt", Instant.now().toString());
    JsonNode sent =
        api.as(token)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft))
            .retrieve()
            .body(JsonNode.class);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));
    String thread = sent.get("threadId").asString();

    String graceToken = signIn(grace);
    assertThat(ids("to:grace")).containsExactly(thread);
    assertThat(ids("to:eve")).containsExactly(thread);
    assertThat(ids(graceToken, "to:grace")).containsExactly(thread);
    assertThat(ids(graceToken, "to:eve")).isEmpty();
    assertThat(ids(graceToken, "eve")).isEmpty();
    assertThat(ids(signIn(eve), "gears")).containsExactly(thread);
  }

  @Test
  void rejectsBadRequests() {
    assertThat(status("/search?q=")).isEqualTo(422);
    assertThat(status("/search?q={q}", "   ")).isEqualTo(422);
    assertThat(status("/search?q=x&limit=0")).isEqualTo(422);
    assertThat(status("/search?q=x&limit=101")).isEqualTo(422);
    assertThat(status("/search?q=x&cursor=not-a-cursor")).isEqualTo(400);
    ResponseEntity<JsonNode> anonymous =
        api.http().get().uri("/search?q=x").retrieve().toEntity(JsonNode.class);
    assertThat(anonymous.getStatusCode().value()).isEqualTo(401);
  }

  private int status(String uri, Object... vars) {
    return api.as(token)
        .get()
        .uri(uri, vars)
        .retrieve()
        .toEntity(JsonNode.class)
        .getStatusCode()
        .value();
  }

  private List<String> ids(String q) {
    return ids(token, q);
  }

  private List<String> ids(String as, String q) {
    List<String> out = new ArrayList<>();
    search(as, q, "").get("items").forEach(item -> out.add(item.get("id").asString()));
    return out;
  }

  private JsonNode search(String q, String extra) {
    return search(token, q, extra);
  }

  private JsonNode search(String as, String q, String extra) {
    return api.as(as).get().uri("/search?q={q}" + extra, q).retrieve().body(JsonNode.class);
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

  private static String id(MailboxEntry entry) {
    return entry.getThreadId().toString();
  }
}
