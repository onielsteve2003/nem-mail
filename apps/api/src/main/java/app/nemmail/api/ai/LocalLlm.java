package app.nemmail.api.ai;

import java.util.Optional;

/**
 * A generative model for local development only (Ollama). Production has none: abstractive
 * summaries stay on the device and the server uses the extractive models.
 */
public interface LocalLlm {

  boolean available();

  /** The model's answer, or empty when off, failing, or past the timeout. */
  Optional<String> generate(String prompt);

  LocalLlm NONE =
      new LocalLlm() {
        @Override
        public boolean available() {
          return false;
        }

        @Override
        public Optional<String> generate(String prompt) {
          return Optional.empty();
        }
      };
}
