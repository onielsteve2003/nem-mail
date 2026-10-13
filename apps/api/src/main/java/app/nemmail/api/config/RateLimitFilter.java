package app.nemmail.api.config;

import app.nemmail.api.common.ApiErrorResponse;
import app.nemmail.api.common.ErrorCode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * A token bucket per client IP, in memory (one instance on the free host), for the requests {@code
 * applies} selects. The IP is the remote address, which Tomcat takes from {@code X-Forwarded-For}
 * only when a trusted proxy sent it. Preflights are never counted.
 */
class RateLimitFilter extends OncePerRequestFilter {

  private final Cache<String, Bucket> buckets =
      Caffeine.newBuilder().expireAfterAccess(Duration.ofMinutes(10)).maximumSize(100_000).build();
  private final int perMinute;
  private final Predicate<HttpServletRequest> applies;
  private final String message;
  private final JsonMapper json;

  RateLimitFilter(
      int perMinute, Predicate<HttpServletRequest> applies, String message, JsonMapper json) {
    this.perMinute = perMinute;
    this.applies = applies;
    this.message = message;
    this.json = json;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return HttpMethod.OPTIONS.matches(request.getMethod()) || !applies.test(request);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Bucket bucket = buckets.get(request.getRemoteAddr(), ip -> newBucket());
    ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
    if (probe.isConsumed()) {
      response.setHeader("RateLimit-Remaining", Long.toString(probe.getRemainingTokens()));
      chain.doFilter(request, response);
      return;
    }
    long retryAfter = TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1;
    response.setStatus(ErrorCode.RATE_LIMITED.status().value());
    response.setHeader("Retry-After", Long.toString(retryAfter));
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    json.writeValue(
        response.getOutputStream(), ApiErrorResponse.of(ErrorCode.RATE_LIMITED, message, null));
  }

  private Bucket newBucket() {
    return Bucket.builder()
        .addLimit(limit -> limit.capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)))
        .build();
  }
}
