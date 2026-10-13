package app.nemmail.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings under {@code nem.*} in application.yml. */
@ConfigurationProperties("nem")
public record ApiProperties(Cors cors, RateLimit rateLimit) {

  /** Origins allowed to call the API: the web app and the Capacitor shells. */
  public record Cors(List<String> allowedOrigins) {}

  /**
   * Requests per minute for each client IP: across the whole API, and (stricter) on sign-in and
   * sign-up, which also count toward the first.
   */
  public record RateLimit(int requestsPerMinute, int authRequestsPerMinute) {}
}
