package app.nemmail.api.support;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.mail.LabelColor;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@IntegrationTest
class IntegrationHarnessTest {

  @Autowired private MockMvcTester mvc;
  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private MailboxEntryRepository entries;

  @Test
  void mockMvcRunsTheFiltersWithoutTheContextPath() {
    assertThat(mvc.get().uri("/nowhere"))
        .hasStatus(404)
        .hasHeader("X-Content-Type-Options", "nosniff")
        .bodyJson()
        .extractingPath("$.error.code")
        .isEqualTo("NOT_FOUND");
  }

  @Test
  void apiClientHitsTheRealServerAndNeverThrows() {
    ResponseEntity<String> health =
        api.http().get().uri("/health").retrieve().toEntity(String.class);
    ResponseEntity<String> missing =
        api.as("some-token").get().uri("/nowhere").retrieve().toEntity(String.class);

    assertThat(health.getBody()).contains("\"status\":\"UP\"");
    assertThat(missing.getStatusCode().value()).isEqualTo(404);
  }

  @Test
  void factoriesCreateUniqueUsersAndInboxMail() {
    User ada = data.user("Ada");
    User another = data.user("Ada");
    MailboxEntry entry =
        data.received(
            ada, "grace@example.com", "Engine notes", Instant.parse("2026-10-13T09:00:00Z"));
    data.label(ada, "Work", LabelColor.VIOLET);

    assertThat(ada.getEmail()).isNotEqualTo(another.getEmail());
    assertThat(entries.findByUserIdAndThreadId(ada.getId(), entry.getThreadId()))
        .singleElement()
        .extracting(MailboxEntry::getMailbox)
        .isEqualTo(Mailbox.INBOX);
  }
}
