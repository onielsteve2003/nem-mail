package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Spam and phishing (AI-2), a port of {@code spam-nb.ts}: Naive Bayes plus phishing rules. */
public final class SpamModel {

  public record Verdict(boolean isSpam, boolean isPhishing) {}

  public static final List<String> CLASSES = List.of("ham", "spam");

  /** At or above this spam probability a message is flagged. */
  public static final double THRESHOLD = 0.5;

  /** A user's report counts as this many seed samples. */
  public static final double FEEDBACK_WEIGHT = 3;

  private static final Pattern MONEY =
      Pattern.compile("[$€£]\\s?\\d|\\d+\\s?(?:dollars|usd)\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern SHOUT = Pattern.compile("\\b[A-Z]{4,}\\b");
  private static final Pattern BANG = Pattern.compile("!+");
  private static final Pattern LINK = Pattern.compile("https?://", Pattern.CASE_INSENSITIVE);

  private SpamModel() {}

  /** Content words (2+ letters) plus shape markers. */
  public static List<String> features(String text) {
    List<String> features = new ArrayList<>(Text.tokenize(text, true, 2));
    if (MONEY.matcher(text).find()) {
      features.add("__money");
    }
    if (SHOUT.matcher(text).find()) {
      features.add("__shout");
    }
    if (BANG.matcher(text).find()) {
      features.add("__bang");
    }
    if (LINK.matcher(text).find()) {
      features.add("__link");
    }
    return features;
  }

  public static NaiveBayes train(List<Corpora.SpamSample> samples) {
    NaiveBayes model = NaiveBayes.create(CLASSES);
    for (Corpora.SpamSample sample : samples) {
      model.learn(features(sample.text()), sample.isSpam() ? "spam" : "ham", 1);
    }
    return model;
  }

  /** "Report spam" / "Not spam": a correction first unlearns the opposite lesson. */
  public static void learnFeedback(NaiveBayes model, String text, boolean isSpam) {
    List<String> features = features(text);
    model.unlearn(features, isSpam ? "ham" : "spam", FEEDBACK_WEIGHT);
    model.learn(features, isSpam ? "spam" : "ham", FEEDBACK_WEIGHT);
  }

  public static double probability(NaiveBayes model, String text) {
    return model.predict(features(text)).probabilities().get("spam");
  }

  /** Classifies one message and explains the verdict in plain words. */
  public static AiInsight<Verdict> classify(NaiveBayes model, Phishing.Input message) {
    List<String> features = features(message.subject() + "\n" + message.bodyText());
    double probability = model.predict(features).probabilities().get("spam");
    List<Phishing.Finding> findings = Phishing.check(message);
    boolean phishing = Phishing.isPhishing(findings);
    boolean isSpam = phishing || probability >= THRESHOLD;

    List<String> reasons = new ArrayList<>();
    if (phishing) {
      findings.forEach(finding -> reasons.add(finding.reason()));
    }
    List<String> words =
        model.explain(features, isSpam ? "spam" : "ham", 3).stream()
            .map(NaiveBayes.Evidence::token)
            .filter(token -> !token.startsWith("__"))
            .map(token -> "“" + token + "”")
            .toList();
    if (isSpam && !words.isEmpty()) {
      reasons.add("It uses words common in spam: " + String.join(", ", words) + ".");
    } else if (!isSpam) {
      reasons.add(
          words.isEmpty()
              ? "Nothing in it looks like spam."
              : "It reads like normal mail (" + String.join(", ", words) + ").");
    }

    double confidence =
        phishing ? Math.max(0.9, probability) : isSpam ? probability : 1 - probability;
    return new AiInsight<>(
        new Verdict(isSpam, phishing),
        AiInsight.round(confidence),
        String.join(" ", reasons),
        phishing && probability < THRESHOLD ? AiInsight.HEURISTIC : AiInsight.MODEL);
  }
}
