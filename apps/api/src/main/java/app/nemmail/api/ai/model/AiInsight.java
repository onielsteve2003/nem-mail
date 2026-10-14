package app.nemmail.api.ai.model;

/**
 * Every AI result with how sure it is and why (AIInsight in {@code @nem/shared}). {@code source} is
 * {@code heuristic} when a rule rather than a model produced the value.
 */
public record AiInsight<T>(T value, double confidence, String explanation, String source) {

  public static final String MODEL = "model";
  public static final String HEURISTIC = "heuristic";

  /** Two decimals, as the TS models round ({@code Math.round(x * 100) / 100}). */
  static double round(double value) {
    return Math.round(value * 100) / 100.0;
  }
}
