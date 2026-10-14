package app.nemmail.api.config;

import app.nemmail.api.auth.BearerTokenFilter;
import app.nemmail.api.auth.SessionService;
import app.nemmail.api.common.ApiErrorResponse;
import app.nemmail.api.common.ErrorCode;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * A stateless bearer-token API: no server sessions, cookies, CSRF, form or basic login. A request
 * is signed in by {@link BearerTokenFilter}; only sign-up, sign-in and health are open. CORS and
 * the security headers are handled by the filters in {@link WebConfig}, which run before this chain
 * (preflights never reach it).
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

  @Bean
  SecurityFilterChain apiSecurity(HttpSecurity http, SessionService sessions, JsonMapper json) {
    return http.csrf(AbstractHttpConfigurer::disable)
        .cors(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .requestCache(AbstractHttpConfigurer::disable)
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // SecurityHeadersFilter sets the rest; keep only Cache-Control: no-store.
        .headers(headers -> headers.defaultsDisabled().cacheControl(Customizer.withDefaults()))
        .addFilterBefore(new BearerTokenFilter(sessions), AnonymousAuthenticationFilter.class)
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(HttpMethod.POST, "/auth/signup", "/auth/signin")
                    .permitAll()
                    // Guarded by its own key in DemoController, for the nightly cron.
                    .requestMatchers(HttpMethod.POST, "/admin/demo/reset")
                    .permitAll()
                    .requestMatchers("/health", "/error")
                    .permitAll()
                    // The re-dispatch that ends an SSE stream; its request was authorized already,
                    // and BearerTokenFilter does not run again for it.
                    .dispatcherTypeMatchers(DispatcherType.ASYNC)
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (request, response, e) ->
                            write(json, response, ErrorCode.UNAUTHORIZED, "Sign in to continue."))
                    .accessDeniedHandler(
                        (request, response, e) ->
                            write(json, response, ErrorCode.FORBIDDEN, "You can't do that.")))
        .build();
  }

  /**
   * Argon2id with Spring Security's current defaults (16 MiB, 2 iterations, 1 lane): about 50 ms a
   * hash, and small enough for the 512 MB free host.
   */
  @Bean
  PasswordEncoder passwordEncoder() {
    return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
  }

  private static void write(
      JsonMapper json, HttpServletResponse response, ErrorCode code, String message)
      throws IOException {
    response.setStatus(code.status().value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    json.writeValue(response.getOutputStream(), ApiErrorResponse.of(code, message, null));
  }
}
