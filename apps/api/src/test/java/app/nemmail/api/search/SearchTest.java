package app.nemmail.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class SearchTest {

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

  private List<String> ids(String q) {
    List<String> out = new ArrayList<>();
    search(q, "").get("items").forEach(item -> out.add(item.get("id").asString()));
    return out;
  }

  private JsonNode search(String q, String extra) {
    return api.http()
        .get()
        .uri("/search?q={q}" + extra, q)
        .header("Authorization", "Bearer " + token)
        .retrieve()
        .body(JsonNode.class);
  }

  private static String id(MailboxEntry entry) {
    return entry.getThreadId().toString();
  }
}
