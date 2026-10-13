package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestClient;

@IntegrationTest
class HealthTest {

  @LocalServerPort private int port;

  @Test
  void healthIsUpUnderApiBasePath() {
    String body =
        RestClient.create()
            .get()
            .uri("http://localhost:" + port + "/api/v1/health")
            .retrieve()
            .body(String.class);

    assertThat(body).contains("\"status\":\"UP\"");
  }
}
