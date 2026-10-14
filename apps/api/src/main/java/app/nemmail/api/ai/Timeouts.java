package app.nemmail.api.ai;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runs a provider call on its own virtual thread with a deadline. A slow, failed or null result is
 * {@code Optional.empty()}, so callers fall back to the hand-written models and mail never waits.
 */
public final class Timeouts {

  private static final Logger log = LoggerFactory.getLogger(Timeouts.class);

  private Timeouts() {}

  public static <T> Optional<T> within(Duration limit, String what, Callable<T> call) {
    FutureTask<T> task = new FutureTask<>(call);
    Thread.ofVirtual().name("ai-" + what).start(task);
    try {
      return Optional.ofNullable(task.get(limit.toMillis(), TimeUnit.MILLISECONDS));
    } catch (TimeoutException e) {
      task.cancel(true);
      log.warn("AI provider {} took longer than {}", what, limit);
    } catch (ExecutionException e) {
      log.warn("AI provider {} failed", what, e.getCause());
    } catch (InterruptedException e) {
      task.cancel(true);
      Thread.currentThread().interrupt();
    }
    return Optional.empty();
  }
}
