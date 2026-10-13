package app.nemmail.api.seed;

import app.nemmail.api.auth.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * The demo accounts portfolio visitors sign in to. Everyone shares them, so they are put back to
 * the seed every night: the seeded users are deleted (their sessions, mail, labels, drafts and
 * settings cascade) and the seed is loaded again with fresh timestamps.
 */
@Service
public class DemoService {

  static final Resource SEED = new ClassPathResource("seed/seed.json");

  private static final Logger log = LoggerFactory.getLogger(DemoService.class);

  private final SeedLoader loader;
  private final UserRepository users;
  private final JdbcClient jdbc;
  private final JsonMapper json;

  DemoService(SeedLoader loader, UserRepository users, JdbcClient jdbc, JsonMapper json) {
    this.loader = loader;
    this.users = users;
    this.jdbc = jdbc;
    this.json = json;
  }

  /** The seed on the classpath; empty when the build did not copy it there. */
  public Optional<SeedData> seed() {
    if (!SEED.exists()) {
      return Optional.empty();
    }
    try (InputStream in = SEED.getInputStream()) {
      return Optional.of(json.readValue(in, SeedData.class));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  /** Seeds an empty database (first start). */
  @Transactional
  public void seedIfEmpty() {
    if (users.count() > 0) {
      return;
    }
    seed()
        .ifPresentOrElse(
            data -> {
              loader.load(data, Instant.now());
              log.info("Seeded {} demo accounts", data.accounts().size());
            },
            () ->
                log.warn(
                    "No seed/seed.json on the classpath; run npm run seed:export -w"
                        + " packages/shared"));
  }

  /**
   * Puts the demo accounts back to the seed. Visitors signed in to them are signed out. Accounts
   * people signed up for are untouched, apart from mail they exchanged with the demo accounts.
   *
   * @return false when there is no seed to reset to
   */
  @Transactional
  public boolean reset() {
    Optional<SeedData> data = seed();
    if (data.isEmpty()) {
      return false;
    }
    clear(data.get());
    loader.load(data.get(), Instant.now());
    log.info("Reset {} demo accounts", data.get().accounts().size());
    return true;
  }

  /** Deletes the seeded accounts, then every thread no account has left in a mailbox. */
  @Transactional
  public void clear(SeedData data) {
    List<UUID> ids =
        data.accounts().stream().map(account -> SeedLoader.idOf(account.user().id())).toList();
    jdbc.sql("delete from users where id in (:ids)").param("ids", ids).update();
    jdbc.sql(
            "delete from threads t where not exists"
                + " (select 1 from mailbox_entries e where e.thread_id = t.id)")
        .update();
  }
}
