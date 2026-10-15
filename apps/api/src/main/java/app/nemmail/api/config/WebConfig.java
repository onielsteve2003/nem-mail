package app.nemmail.api.config;

import app.nemmail.api.common.RequestIdFilter;
import jakarta.servlet.Filter;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Servlet filters, outermost first: request ID and logging, security headers, CORS, then rate
 * limiting (the whole API, then the stricter auth limit). CORS runs before the limiters so a 429
 * still carries CORS headers the browser accepts. All of them run before Spring Security's chain
 * (order -100), so a flood of sign-ins is turned away before any password is hashed.
 */
@Configuration(proxyBeanMethods = false)
class WebConfig {

  /** Routes that check a password or create an account: the brute-force and spam targets. */
  static final Set<String> AUTH_PATHS = Set.of("/auth/signin", "/auth/signup");

  @Bean
  UrlBasedCorsConfigurationSource corsConfigurationSource(ApiProperties properties) {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(properties.cors().allowedOrigins());
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    cors.setAllowedHeaders(
        List.of("Authorization", "Content-Type", "Last-Event-ID", RequestIdFilter.HEADER));
    cors.setExposedHeaders(List.of(RequestIdFilter.HEADER, "Retry-After", "RateLimit-Remaining"));
    // Bearer tokens, not cookies (Capacitor runs cross-origin).
    cors.setAllowCredentials(false);
    cors.setMaxAge(Duration.ofHours(1));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return source;
  }

  @Bean
  FilterRegistrationBean<RequestIdFilter> requestIdFilter() {
    return register(new RequestIdFilter(), 0);
  }

  @Bean
  FilterRegistrationBean<SecurityHeadersFilter> securityHeadersFilter() {
    return register(new SecurityHeadersFilter(), 1);
  }

  @Bean
  FilterRegistrationBean<CorsFilter> corsFilterRegistration(
      UrlBasedCorsConfigurationSource source) {
    return register(new CorsFilter(source), 2);
  }

  @Bean
  FilterRegistrationBean<RateLimitFilter> rateLimitFilter(
      ApiProperties properties, JsonMapper json) {
    return register(
        new RateLimitFilter(
            properties.rateLimit().requestsPerMinute(),
            properties.rateLimit().clientIpHeader(),
            request -> !request.getServletPath().equals("/health"),
            "Too many requests. Try again in a moment.",
            json),
        3);
  }

  @Bean
  FilterRegistrationBean<RateLimitFilter> authRateLimitFilter(
      ApiProperties properties, JsonMapper json) {
    return register(
        new RateLimitFilter(
            properties.rateLimit().authRequestsPerMinute(),
            properties.rateLimit().clientIpHeader(),
            request ->
                HttpMethod.POST.matches(request.getMethod())
                    && AUTH_PATHS.contains(request.getServletPath()),
            "Too many sign-in attempts. Wait a minute and try again.",
            json),
        4);
  }

  private static <F extends Filter> FilterRegistrationBean<F> register(F filter, int position) {
    FilterRegistrationBean<F> registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + position);
    return registration;
  }
}
