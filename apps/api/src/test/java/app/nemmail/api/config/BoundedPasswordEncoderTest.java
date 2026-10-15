package app.nemmail.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class BoundedPasswordEncoderTest {

  @Test
  void runsAtMostThePermittedHashesAtOnce() throws Exception {
    AtomicInteger running = new AtomicInteger();
    AtomicInteger peak = new AtomicInteger();
    PasswordEncoder slow =
        new PasswordEncoder() {
          @Override
          public String encode(CharSequence raw) {
            int now = running.incrementAndGet();
            peak.accumulateAndGet(now, Math::max);
            try {
              Thread.sleep(20);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }
            running.decrementAndGet();
            return "hash";
          }

          @Override
          public boolean matches(CharSequence raw, String encoded) {
            return encode(raw).equals(encoded);
          }
        };
    PasswordEncoder bounded = new BoundedPasswordEncoder(slow, 2);

    try (var threads = Executors.newVirtualThreadPerTaskExecutor()) {
      for (int i = 0; i < 20; i++) {
        threads.submit(() -> bounded.matches("guess", "hash"));
      }
    }

    assertThat(peak.get()).isEqualTo(2);
    assertThat(bounded.matches("guess", "hash")).isTrue();
  }
}
