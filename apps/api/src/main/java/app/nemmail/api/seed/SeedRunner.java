package app.nemmail.api.seed;

import app.nemmail.api.auth.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Seeds the demo accounts on startup in the local and demo profiles, once: it does nothing when any
 * user exists. The seed is {@code packages/shared/fixtures/seed.json}, copied onto the classpath by
 * the build.
 */
@Component
@Profile({"local", "demo"})
class SeedRunner implements ApplicationRunner {

  static final Resource SEED = new ClassPathResource("seed/seed.json");

  private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

  private final SeedLoader loader;
  private final UserRepository users;
  private final JsonMapper json;

  SeedRunner(SeedLoader loader, UserRepository users, JsonMapper json) {
    this.loader = loader;
    this.users = users;
    this.json = json;
  }

  @Override
  public void run(ApplicationArguments args) throws IOException {
    if (users.count() > 0) {
      return;
    }
    if (!SEED.exists()) {
      log.warn("No seed/seed.json on the classpath; run npm run seed:export -w packages/shared");
      return;
    }
    try (InputStream in = SEED.getInputStream()) {
      SeedData data = json.readValue(in, SeedData.class);
      loader.load(data, Instant.now());
      log.info("Seeded {} demo accounts", data.accounts().size());
    }
  }
}
