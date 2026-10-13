package app.nemmail.api.seed;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Seeds the demo accounts on startup in the local and demo profiles, once: it does nothing when any
 * user exists. The seed is {@code packages/shared/fixtures/seed.json}, copied onto the classpath by
 * the build.
 */
@Component
@Profile({"local", "demo"})
class SeedRunner implements ApplicationRunner {

  private final DemoService demo;

  SeedRunner(DemoService demo) {
    this.demo = demo;
  }

  @Override
  public void run(ApplicationArguments args) {
    demo.seedIfEmpty();
  }
}
