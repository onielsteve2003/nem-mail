package app.nemmail.api.ai;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** {@code POST /api/generate} on a local Ollama server, one non-streamed answer per call. */
final class OllamaLlm implements LocalLlm {

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);

  private final RestClient http;
  private final String model;
  private final Duration timeout;

  OllamaLlm(AiProperties.Ollama settings) {
    JdkClientHttpRequestFactory requests =
        new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
    requests.setReadTimeout(settings.timeout());
    this.http = RestClient.builder().baseUrl(settings.url()).requestFactory(requests).build();
    this.model = settings.model();
    this.timeout = settings.timeout();
  }

  @Override
  public boolean available() {
    return true;
  }

  @Override
  public Optional<String> generate(String prompt) {
    return Timeouts.within(
            timeout,
            "ollama",
            () ->
                http.post()
                    .uri("/api/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", model, "prompt", prompt, "stream", false))
                    .retrieve()
                    .body(JsonNode.class))
        .map(body -> body.path("response").asString(""))
        .map(String::strip)
        .filter(text -> !text.isEmpty());
  }
}
