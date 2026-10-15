package app.nemmail.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings under {@code nem.*} in application.yml. */
@ConfigurationProperties("nem")
public record ApiProperties(Cors cors, RateLimit rateLimit, Demo demo) {

  /** Origins allowed to call the API: the web app and the Capacitor shells. */
  public record Cors(List<String> allowedOrigins) {}

  /**
   * Requests per minute for each client IP: across the whole API, and (stricter) on sign-in and
   * sign-up, which also count toward the first. {@code clientIpHeader} names a header the edge
   * proxy overwrites with the client's IP; blank uses the connection's remote address.
   */
  public record RateLimit(
      int requestsPerMinute, int authRequestsPerMinute, String clientIpHeader) {}

  /**
   * The seeded demo accounts. {@code password} is public on purpose: it is {@code DEMO_PASSWORD} in
   * {@code @nem/shared}, which the app sends for "Try the demo". {@code resetKey} guards the reset
   * endpoint; blank turns that endpoint off.
   */
  public record Demo(String password, String resetKey) {}
}
