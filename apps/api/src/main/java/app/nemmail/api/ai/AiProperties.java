package app.nemmail.api.ai;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code nem.ai.*}. The hand-written models always run; the two heavier providers
 * are off unless configured.
 *
 * @param ingest whether delivered mail runs through {@link IngestPipeline}; on in production, off
 *     in the shared integration-test context so unrelated tests do not race it.
 * @param embeddings MiniLM sentence embeddings through ONNX Runtime (DJL). Off by default: the
 *     runtime adds about 150 MB and the free host has 512 MB, so the app computes embeddings on the
 *     device instead. Turning it on also needs a build with {@code -PwithEmbeddings}.
 * @param ollama a local Ollama server for generated text; blank {@code url} turns it off. Never set
 *     in production (PRD: no mail content leaves the app's own servers).
 */
@ConfigurationProperties("nem.ai")
public record AiProperties(Ingest ingest, Embeddings embeddings, Ollama ollama) {

  public record Ingest(boolean enabled) {}

  public record Embeddings(boolean enabled, String modelUrl, Duration timeout) {}

  public record Ollama(String url, String model, Duration timeout) {}
}
