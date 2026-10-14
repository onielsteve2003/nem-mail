package app.nemmail.api.ai;

import ai.djl.huggingface.translator.TextEmbeddingTranslatorFactory;
import ai.djl.inference.Predictor;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ZooModel;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * MiniLM through ONNX Runtime (DJL). The model downloads and loads on a background thread at
 * startup; until then {@link #embed} is empty. Only built with {@code -PwithEmbeddings}, since the
 * runtime is too big to ship by default (see {@link AiProperties}).
 */
final class OnnxEmbedder implements Embedder {

  /** Loaded by {@link AiConfig} only when DJL is on the classpath. */
  static final String PROBE_CLASS = "ai.djl.repository.zoo.Criteria";

  private static final Logger log = LoggerFactory.getLogger(OnnxEmbedder.class);

  private final Duration timeout;
  private volatile ZooModel<String, float[]> model;

  OnnxEmbedder(AiProperties.Embeddings settings) {
    this.timeout = settings.timeout();
    Thread.ofVirtual().name("ai-embedder-load").start(() -> load(settings.modelUrl()));
  }

  private void load(String url) {
    try {
      Criteria<String, float[]> criteria =
          Criteria.builder()
              .setTypes(String.class, float[].class)
              .optModelUrls(url)
              .optEngine("OnnxRuntime")
              .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
              .optArgument("pooling", "mean")
              .optArgument("normalize", "true")
              .build();
      model = criteria.loadModel();
      log.info("Embedding model loaded from {}", url);
    } catch (Exception | LinkageError e) {
      log.warn(
          "Could not load the embedding model from {}; semantic search stays on-device", url, e);
    }
  }

  @Override
  public boolean ready() {
    return model != null;
  }

  @Override
  public Optional<List<float[]>> embed(List<String> texts) {
    ZooModel<String, float[]> loaded = model;
    if (loaded == null || texts.isEmpty()) {
      return Optional.empty();
    }
    return Timeouts.within(
        timeout,
        "embed",
        () -> {
          try (Predictor<String, float[]> predictor = loaded.newPredictor()) {
            return predictor.batchPredict(texts);
          }
        });
  }
}
