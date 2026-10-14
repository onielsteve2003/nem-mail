package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AiProvidersTest {

  private HttpServer server;

  @AfterEach
  void stop() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void timeoutsGiveUpOnSlowAndFailingCalls() {
    assertThat(Timeouts.within(Duration.ofSeconds(1), "fast", () -> "ok")).contains("ok");
    assertThat(
            Timeouts.within(
                Duration.ofMillis(50),
                "slow",
                () -> {
                  Thread.sleep(2000);
                  return "late";
                }))
        .isEmpty();
    assertThat(
            Timeouts.<String>within(
                Duration.ofSeconds(1),
                "broken",
                () -> {
                  throw new IllegalStateException("boom");
                }))
        .isEmpty();
  }

  @Test
  void optionalProvidersAreOffByDefaultAndWithoutDjl() {
    AiConfig config = new AiConfig();
    AiProperties.Ollama noOllama =
        new AiProperties.Ollama("", "qwen2.5:0.5b", Duration.ofSeconds(1));
    AiProperties off =
        new AiProperties(
            new AiProperties.Ingest(true),
            new AiProperties.Embeddings(false, "x", Duration.ofSeconds(1)),
            noOllama);
    assertThat(config.embedder(off)).isSameAs(Embedder.NONE);
    assertThat(config.localLlm(off)).isSameAs(LocalLlm.NONE);
    assertThat(Embedder.NONE.embed(List.of("hello"))).isEmpty();
    assertThat(LocalLlm.NONE.generate("hello")).isEmpty();

    // Tests run without -PwithEmbeddings, so turning embeddings on still falls back.
    AiProperties on =
        new AiProperties(
            new AiProperties.Ingest(true),
            new AiProperties.Embeddings(true, "x", Duration.ofSeconds(1)),
            noOllama);
    assertThat(config.embedder(on)).isSameAs(Embedder.NONE);
  }

  @Test
  void ollamaSendsThePromptAndReadsTheAnswer() throws IOException {
    AtomicReference<String> request = new AtomicReference<>();
    LocalLlm llm =
        ollama(request, "{\"model\":\"m\",\"response\":\"  Hello there. \",\"done\":true}", 0);

    assertThat(llm.available()).isTrue();
    assertThat(llm.generate("Say hi")).contains("Hello there.");
    assertThat(request.get())
        .contains("\"prompt\":\"Say hi\"")
        .contains("\"model\":\"qwen2.5:0.5b\"")
        .contains("\"stream\":false");
  }

  @Test
  void ollamaIsEmptyWhenSlowOrDown() throws IOException {
    assertThat(ollama(new AtomicReference<>(), "{\"response\":\"late\"}", 1500).generate("x"))
        .isEmpty();
    stop();
    LocalLlm down =
        new OllamaLlm(
            new AiProperties.Ollama(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "qwen2.5:0.5b",
                Duration.ofSeconds(1)));
    server = null;
    assertThat(down.generate("x")).isEmpty();
  }

  private LocalLlm ollama(AtomicReference<String> request, String answer, long delayMs)
      throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/api/generate",
        exchange -> {
          request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
          try {
            Thread.sleep(delayMs);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
          byte[] body = answer.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
          }
        });
    server.start();
    return new OllamaLlm(
        new AiProperties.Ollama(
            "http://127.0.0.1:" + server.getAddress().getPort(),
            "qwen2.5:0.5b",
            Duration.ofMillis(500)));
  }
}
