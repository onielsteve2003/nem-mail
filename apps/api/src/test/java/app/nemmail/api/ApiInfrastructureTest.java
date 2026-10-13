package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.TestcontainersConfiguration;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import({TestcontainersConfiguration.class, ApiInfrastructureTest.Probe.class})
class ApiInfrastructureTest {

  /** Endpoints that exercise the infrastructure; only present in this test. */
  @RestController
  static class Probe {

    record SignUp(@NotBlank String name, @NotBlank @Email String email) {}

    @PostMapping("/probe/signup")
    SignUp signUp(@Valid @RequestBody SignUp body) {
      return body;
    }

    @GetMapping("/probe/conflict")
    String conflict() {
      throw new ApiException(ErrorCode.CONFLICT, "That email is taken.");
    }

    @GetMapping("/probe/boom")
    String boom() {
      throw new IllegalStateException("secret internals at line 42");
    }

    @GetMapping("/probe/ping")
    String ping() {
      return "pong";
    }

    /** Opens the probe endpoints, ahead of the API chain that requires a signed-in user. */
    @Bean
    @Order(0)
    SecurityFilterChain probeSecurity(HttpSecurity http) {
      return http.securityMatcher("/probe/**")
          .csrf(AbstractHttpConfigurer::disable)
          .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
          .build();
    }
  }

  @LocalServerPort private int port;

  private RestClient http;

  @BeforeEach
  void setUp() {
    http = ApiClient.create(port);
  }

  @Test
  void invalidBodyIsA422WithFieldDetails() {
    ResponseEntity<String> response =
        http.post()
            .uri("/probe/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"name\":\"\",\"email\":\"nope\"}")
            .retrieve()
            .toEntity(String.class);

    assertThat(response.getStatusCode().value()).isEqualTo(422);
    assertThat(response.getBody())
        .contains("\"code\":\"VALIDATION_FAILED\"")
        .contains("\"field\":\"name\"")
        .contains("\"field\":\"email\"");
  }

  @Test
  void clientAndServerErrorsUseTheEnvelopeWithoutInternals() {
    ResponseEntity<String> malformed =
        http.post()
            .uri("/probe/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .body("{oops")
            .retrieve()
            .toEntity(String.class);
    ResponseEntity<String> conflict =
        http.get().uri("/probe/conflict").retrieve().toEntity(String.class);
    ResponseEntity<String> missing =
        http.get().uri("/probe/nowhere").retrieve().toEntity(String.class);
    ResponseEntity<String> boom = http.get().uri("/probe/boom").retrieve().toEntity(String.class);

    assertThat(malformed.getStatusCode().value()).isEqualTo(400);
    assertThat(malformed.getBody()).contains("\"code\":\"BAD_REQUEST\"");
    assertThat(conflict.getStatusCode().value()).isEqualTo(409);
    assertThat(conflict.getBody())
        .isEqualTo("{\"error\":{\"code\":\"CONFLICT\",\"message\":\"That email is taken.\"}}");
    assertThat(missing.getStatusCode().value()).isEqualTo(404);
    assertThat(missing.getBody()).contains("\"code\":\"NOT_FOUND\"");
    assertThat(boom.getStatusCode().value()).isEqualTo(500);
    assertThat(boom.getBody())
        .contains("\"code\":\"INTERNAL\"")
        .doesNotContain("secret")
        .doesNotContain("Exception");
  }

  @Test
  void echoesOrCreatesTheRequestIdAndSetsSecurityHeaders() {
    ResponseEntity<String> given =
        http.get()
            .uri("/probe/ping")
            .header("X-Request-Id", "abc-123")
            .retrieve()
            .toEntity(String.class);
    ResponseEntity<String> made =
        http.get()
            .uri("/probe/ping")
            .header("X-Request-Id", "not a <safe> id")
            .retrieve()
            .toEntity(String.class);

    assertThat(given.getHeaders().getFirst("X-Request-Id")).isEqualTo("abc-123");
    assertThat(made.getHeaders().getFirst("X-Request-Id")).hasSize(36);
    assertThat(given.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
    assertThat(given.getHeaders().getFirst("X-Frame-Options")).isEqualTo("DENY");
    assertThat(given.getHeaders().getFirst("Content-Security-Policy"))
        .contains("default-src 'none'");
  }

  @Test
  void corsAllowsTheAppOriginsOnly() {
    ResponseEntity<Void> vercel = preflight("https://nem-mail.vercel.app");
    ResponseEntity<Void> capacitor = preflight("capacitor://localhost");
    ResponseEntity<Void> evil = preflight("https://evil.example");

    assertThat(vercel.getHeaders().getAccessControlAllowOrigin())
        .isEqualTo("https://nem-mail.vercel.app");
    assertThat(capacitor.getHeaders().getAccessControlAllowOrigin())
        .isEqualTo("capacitor://localhost");
    assertThat(evil.getStatusCode().value()).isEqualTo(403);
    assertThat(evil.getHeaders().getAccessControlAllowOrigin()).isNull();
  }

  @Test
  void rateLimitsEachClientIpWithA429Envelope() {
    // Tomcat trusts X-Forwarded-For from localhost, as it will from Render's proxy.
    String ip = "203.0.113.7";
    for (int i = 0; i < 120; i++) {
      assertThat(ping(ip).getStatusCode().value()).isEqualTo(200);
    }
    ResponseEntity<String> limited = ping(ip);

    assertThat(limited.getStatusCode().value()).isEqualTo(429);
    assertThat(limited.getHeaders().getFirst("Retry-After")).isNotBlank();
    assertThat(limited.getBody()).contains("\"code\":\"RATE_LIMITED\"");
    assertThat(ping("203.0.113.8").getStatusCode().value()).isEqualTo(200);
  }

  @Test
  void signInAndSignUpHaveAStricterLimitOfTheirOwn() {
    String ip = "203.0.113.20";
    for (int i = 0; i < 10; i++) {
      assertThat(signIn(ip).getStatusCode().value()).isEqualTo(401);
    }
    ResponseEntity<String> limited = signIn(ip);

    assertThat(limited.getStatusCode().value()).isEqualTo(429);
    assertThat(limited.getHeaders().getFirst("Retry-After")).isNotBlank();
    assertThat(limited.getBody()).contains("\"code\":\"RATE_LIMITED\"");
    // Sign-up shares the bucket; the rest of the API and other clients are untouched.
    assertThat(
            http.post()
                .uri("/auth/signup")
                .header("X-Forwarded-For", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{}")
                .retrieve()
                .toEntity(String.class)
                .getStatusCode()
                .value())
        .isEqualTo(429);
    assertThat(ping(ip).getStatusCode().value()).isEqualTo(200);
    assertThat(signIn("203.0.113.21").getStatusCode().value()).isEqualTo(401);
  }

  private ResponseEntity<String> signIn(String ip) {
    return http.post()
        .uri("/auth/signin")
        .header("X-Forwarded-For", ip)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"email\":\"nobody@nemmail.example\",\"password\":\"guess-guess\"}")
        .retrieve()
        .toEntity(String.class);
  }

  private ResponseEntity<String> ping(String ip) {
    return http.get()
        .uri("/probe/ping")
        .header("X-Forwarded-For", ip)
        .retrieve()
        .toEntity(String.class);
  }

  private ResponseEntity<Void> preflight(String origin) {
    return http.method(HttpMethod.OPTIONS)
        .uri("/probe/ping")
        .header("Origin", origin)
        .header("Access-Control-Request-Method", "GET")
        .header("Access-Control-Request-Headers", "authorization")
        .retrieve()
        .toBodilessEntity();
  }
}
