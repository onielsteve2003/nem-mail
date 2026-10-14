package app.nemmail.api.ai;

import java.util.List;
import java.util.Optional;

/**
 * Sentence embeddings for semantic search: all-MiniLM-L6-v2 (Apache-2.0), 384 dimensions, mean
 * pooled and L2-normalized like the app's Transformers.js model, so vectors from either side
 * compare. Empty when off, still loading, or too slow; callers then fall back to keyword search or
 * the app's own vectors.
 */
public interface Embedder {

  int DIMENSIONS = 384;

  /** Whether {@link #embed} can answer now (the model is loaded). */
  boolean ready();

  Optional<List<float[]>> embed(List<String> texts);

  /** The default: no server embeddings. */
  Embedder NONE =
      new Embedder() {
        @Override
        public boolean ready() {
          return false;
        }

        @Override
        public Optional<List<float[]>> embed(List<String> texts) {
          return Optional.empty();
        }
      };
}
