package app.nemmail.api.seed;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.IntegrationTest;
import jakarta.persistence.EntityManager;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
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
    try (InputStream in = SeedRunner.SEED.getInputStream()) {
      data = json.readValue(in, SeedData.class);
    }
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
    assertThat(count("users")).isEqualTo(data.accounts().size());
    assertThat(count("threads")).isEqualTo(threads);
    assertThat(count("messages")).isEqualTo(messages);
    assertThat(count("mailbox_entries")).isEqualTo(messages);
    assertThat(count("settings")).isEqualTo(data.accounts().size());

    // The newest delivered mail sits as far before now as it sat before generatedAt.
    Instant newestSeed =
        data.accounts().stream()
            .flatMap(a -> a.threads().stream())
            .flatMap(t -> t.messages().stream())
            .filter(m -> m.status().equals("sent"))
            .map(SeedData.Message::sentAt)
            .max(Instant::compareTo)
            .orElseThrow();
    Instant newest =
        jdbc.sql("select max(sent_at) from messages where status = 'sent'")
            .query(OffsetDateTime.class)
            .single()
            .toInstant();
    assertThat(newest).isEqualTo(now.minus(Duration.between(newestSeed, data.generatedAt())));

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
