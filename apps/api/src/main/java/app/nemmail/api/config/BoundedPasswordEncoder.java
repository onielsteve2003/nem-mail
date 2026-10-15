package app.nemmail.api.config;

import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Runs at most {@code permits} hashes at once; the rest wait their turn (on virtual threads, so
 * waiting is cheap). Each Argon2 hash takes 16 MiB, and ten parallel sign-ins pushed the 512 MB
 * free host over its memory limit and restarted it.
 */
class BoundedPasswordEncoder implements PasswordEncoder {

  private final PasswordEncoder delegate;
  private final Semaphore permits;

  BoundedPasswordEncoder(PasswordEncoder delegate, int permits) {
    this.delegate = delegate;
    this.permits = new Semaphore(permits, true);
  }

  @Override
  public String encode(CharSequence rawPassword) {
    return bounded(() -> delegate.encode(rawPassword));
  }

  @Override
  public boolean matches(CharSequence rawPassword, String encodedPassword) {
    return bounded(() -> delegate.matches(rawPassword, encodedPassword));
  }

  @Override
  public boolean upgradeEncoding(String encodedPassword) {
    return delegate.upgradeEncoding(encodedPassword);
  }

  private <T> T bounded(Supplier<T> hash) {
    permits.acquireUninterruptibly();
    try {
      return hash.get();
    } finally {
      permits.release();
    }
  }
}
