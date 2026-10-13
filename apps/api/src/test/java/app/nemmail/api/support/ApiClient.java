package app.nemmail.api.support;

import org.springframework.boot.test.context.TestComponent;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;

/**
 * HTTP against the running server under {@code /api/v1}. Error statuses never throw, so a test
 * asserts on the {@code ResponseEntity} the same way for a 200 and a 422.
 */
@TestComponent
public class ApiClient {

  private final Environment environment;
  private RestClient client;

  ApiClient(Environment environment) {
    this.environment = environment;
  }

  /** An anonymous client. The port is read on first use, once the server has started. */
  public RestClient http() {
    if (client == null) {
      client = create(environment.getRequiredProperty("local.server.port", Integer.class));
    }
    return client;
  }

  /** A client that sends {@code Authorization: Bearer <token>} on every request. */
  public RestClient as(String token) {
    return http().mutate().defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token).build();
  }

  /** For tests with their own context, which pass their {@code @LocalServerPort}. */
  public static RestClient create(int port) {
    return RestClient.builder()
        .baseUrl("http://localhost:" + port + "/api/v1")
        .defaultStatusHandler(status -> true, (request, response) -> {})
        .build();
  }
}
