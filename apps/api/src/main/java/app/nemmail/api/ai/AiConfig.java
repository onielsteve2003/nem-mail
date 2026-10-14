package app.nemmail.api.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.ClassUtils;

/** Picks the optional providers from {@link AiProperties}; each falls back to "none". */
@Configuration
class AiConfig {

  private static final Logger log = LoggerFactory.getLogger(AiConfig.class);

  @Bean
  Embedder embedder(AiProperties properties) {
    if (!properties.embeddings().enabled()) {
      return Embedder.NONE;
    }
    if (!ClassUtils.isPresent(OnnxEmbedder.PROBE_CLASS, AiConfig.class.getClassLoader())) {
      log.warn("nem.ai.embeddings.enabled is on, but this build has no DJL (-PwithEmbeddings)");
      return Embedder.NONE;
    }
    return new OnnxEmbedder(properties.embeddings());
  }

  @Bean
  LocalLlm localLlm(AiProperties properties) {
    String url = properties.ollama().url();
    return url == null || url.isBlank() ? LocalLlm.NONE : new OllamaLlm(properties.ollama());
  }
}
