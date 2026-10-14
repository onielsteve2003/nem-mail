package app.nemmail.api.seed;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.IntegrationTest;
import jakarta.persistence.EntityManager;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
@Transactional
class SeedLoaderTest {

  @Autowired private SeedLoader loader;
  @Autowired private JsonMapper json;
  @Autowired private JdbcClient jdbc;
  @Autowired private EntityManager entityManager;

  @Test
  void loadsTheSharedSeedWithTimestampsMovedToNow() throws Exception {
    SeedData data;
    try (InputStream in = DemoService.SEED.getInputStream()) {
      data = json.readValue(in, SeedData.class);
    }
    // Other test classes share this database, so compare counts before and after.
    long users = count("users");
    long threadRows = count("threads");
    long messageRows = count("messages");
    long entryRows = count("mailbox_entries");
    long settingsRows = count("settings");
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    loader.load(data, now);
    // The checks below use JDBC, which does not trigger Hibernate's auto-flush.
    entityManager.flush();

    long threads = data.accounts().stream().mapToLong(a -> a.threads().size()).sum();
    long messages =
        data.accounts().stream()
            .flatMap(a -> a.threads().stream())
            .mapToLong(t -> t.messages().size())
            .sum();
    assertThat(count("users") - users).isEqualTo(data.accounts().size());
    assertThat(count("threads") - threadRows).isEqualTo(threads);
    assertThat(count("messages") - messageRows).isEqualTo(messages);
    assertThat(count("mailbox_entries") - entryRows).isEqualTo(messages);
    assertThat(count("settings") - settingsRows).isEqualTo(data.accounts().size());

    // The newest delivered mail sits as far before now as it sat before generatedAt. Other test
    // classes add newer mail to the shared database, so look up the seed's own newest message.
    SeedData.Message newestSeed =
        data.accounts().stream()
            .flatMap(a -> a.threads().stream())
            .flatMap(t -> t.messages().stream())
            .filter(m -> m.status().equals("sent"))
            .max(Comparator.comparing(SeedData.Message::sentAt))
            .orElseThrow();
    Instant newest =
        jdbc.sql("select sent_at from messages where id = :id")
            .param("id", SeedLoader.idOf(newestSeed.id()))
            .query(OffsetDateTime.class)
            .single()
            .toInstant();
    assertThat(newest)
        .isEqualTo(now.minus(Duration.between(newestSeed.sentAt(), data.generatedAt())));

    String demo = SeedLoader.idOf(data.accounts().getFirst().user().id()).toString();
    assertThat(
            jdbc.sql(
                    "select count(*) from mailbox_entries where user_id = :u::uuid and mailbox = 'inbox'")
                .param("u", demo)
                .query(Long.class)
                .single())
        .isPositive();
    assertThat(
            jdbc.sql("select count(*) from messages where status = 'scheduled' and send_at > now()")
                .query(Long.class)
                .single())
        .isPositive();
    assertThat(
            jdbc.sql("select count(*) from drafts where payload ->> 'id' = id::text")
                .query(Long.class)
                .single())
        .isEqualTo(count("drafts"))
        .isPositive();
  }

  private long count(String table) {
    return jdbc.sql("select count(*) from " + table).query(Long.class).single();
  }
}
