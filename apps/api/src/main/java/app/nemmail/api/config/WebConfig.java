package app.nemmail.api.config;

import app.nemmail.api.common.RequestIdFilter;
import jakarta.servlet.Filter;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Servlet filters, outermost first: request ID and logging, security headers, CORS, then rate
 * limiting. CORS runs before the limiter so a 429 still carries CORS headers the browser accepts.
 * All of them run before Spring Security's chain (order -100), which arrives with auth.
 */
@Configuration(proxyBeanMethods = false)
class WebConfig {

  @Bean
  UrlBasedCorsConfigurationSource corsConfigurationSource(ApiProperties properties) {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(properties.cors().allowedOrigins());
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type", RequestIdFilter.HEADER));
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
    return register(new RateLimitFilter(properties.rateLimit().requestsPerMinute(), json), 3);
  }

  private static <F extends Filter> FilterRegistrationBean<F> register(F filter, int position) {
    FilterRegistrationBean<F> registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + position);
    return registration;
  }
}
