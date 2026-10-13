package app.nemmail.api.seed;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Resets the demo every night while the instance is awake. The free host sleeps when idle, so a
 * GitHub Actions cron also calls {@code POST /admin/demo/reset}, which wakes it.
 */
@Component
@Profile("demo")
class DemoResetJob {

  private final DemoService demo;

  DemoResetJob(DemoService demo) {
    this.demo = demo;
  }

  @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
  void resetNightly() {
    demo.reset();
  }
}
