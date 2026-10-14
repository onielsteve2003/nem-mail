package app.nemmail.api.ai.model;

import java.util.List;

/**
 * The seed corpora the TS models train on, exported to {@code packages/shared/fixtures/ai} and
 * shipped on the classpath as {@code ai/corpora.json}, so both sides learn from the same text.
 */
public record Corpora(
    List<String> categories,
    List<SpamSample> spamTraining,
    List<SpamSample> spamEval,
    List<CategorySample> categoryTraining,
    List<CategorySample> categoryEval,
    List<String> composeSeed) {

  public static final String RESOURCE = "ai/corpora.json";

  public record SpamSample(String text, boolean isSpam) {}

  public record CategorySample(String from, String subject, String body, String category) {}
}
