package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Multinomial Naive Bayes, a port of {@code naive-bayes.ts}. The state has the TS model's JSON
 * shape ({@code version, classes, docs, totals, counts}), so it can be stored as is.
 */
public record NaiveBayes(
    int version,
    List<String> classes,
    Map<String, Double> docs,
    Map<String, Double> totals,
    Map<String, Map<String, Double>> counts) {

  /** Laplace smoothing: an unseen word gets a count of 1 instead of 0. */
  private static final double ALPHA = 1;

  public record Prediction(String label, Map<String, Double> probabilities) {}

  /** A word that pushed the prediction toward a class, with its log-likelihood ratio. */
  public record Evidence(String token, double weight) {}

  public static NaiveBayes create(List<String> classes) {
    Map<String, Double> docs = new LinkedHashMap<>();
    Map<String, Double> totals = new LinkedHashMap<>();
    classes.forEach(
        c -> {
          docs.put(c, 0.0);
          totals.put(c, 0.0);
        });
    return new NaiveBayes(1, List.copyOf(classes), docs, totals, new LinkedHashMap<>());
  }

  /** Learns one document; {@code weight} > 1 makes feedback count more than seed data. */
  public void learn(List<String> tokens, String label, double weight) {
    docs.merge(label, weight, Double::sum);
    for (String token : tokens) {
      counts.computeIfAbsent(token, t -> new LinkedHashMap<>()).merge(label, weight, Double::sum);
      totals.merge(label, weight, Double::sum);
    }
  }

  /** Removes one previously learned document. */
  public void unlearn(List<String> tokens, String label, double weight) {
    docs.put(label, Math.max(0, docs.get(label) - weight));
    for (String token : tokens) {
      Map<String, Double> row = counts.get(token);
      Double count = row == null ? null : row.get(label);
      if (count == null || count == 0) {
        continue;
      }
      double removed = Math.min(count, weight);
      row.put(label, count - removed);
      totals.put(label, totals.get(label) - removed);
    }
  }

  /** Scores the tokens against every class; unknown words are ignored. */
  public Prediction predict(List<String> tokens) {
    double totalDocs = 0;
    for (String c : classes) {
      totalDocs += docs.get(c);
    }
    List<String> known = tokens.stream().filter(counts::containsKey).toList();
    double[] scores = new double[classes.size()];
    for (int i = 0; i < scores.length; i++) {
      String label = classes.get(i);
      double sum = StrictMath.log((docs.get(label) + ALPHA) / (totalDocs + ALPHA * classes.size()));
      for (String token : known) {
        sum += logLikelihood(token, label);
      }
      scores[i] = sum;
    }
    // Softmax over log scores, shifted by the max so exp() cannot overflow.
    double max = Double.NEGATIVE_INFINITY;
    int best = 0;
    for (int i = 0; i < scores.length; i++) {
      if (scores[i] > max) {
        max = scores[i];
        best = i;
      }
    }
    double[] exps = new double[scores.length];
    double sum = 0;
    for (int i = 0; i < scores.length; i++) {
      exps[i] = StrictMath.exp(scores[i] - max);
      sum += exps[i];
    }
    Map<String, Double> probabilities = new LinkedHashMap<>();
    for (int i = 0; i < scores.length; i++) {
      probabilities.put(classes.get(i), exps[i] / sum);
    }
    return new Prediction(classes.get(best), probabilities);
  }

  /** The words in {@code tokens} that most favor {@code label}, strongest first. */
  public List<Evidence> explain(List<String> tokens, String label, int limit) {
    Set<String> seen = new HashSet<>();
    List<Evidence> evidence = new ArrayList<>();
    for (String token : tokens) {
      if (!counts.containsKey(token) || !seen.add(token)) {
        continue;
      }
      double rival = Double.NEGATIVE_INFINITY;
      for (String other : classes) {
        if (!other.equals(label)) {
          rival = Math.max(rival, logLikelihood(token, other));
        }
      }
      double weight = logLikelihood(token, label) - rival;
      if (weight > 0) {
        evidence.add(new Evidence(token, weight));
      }
    }
    evidence.sort((a, b) -> Double.compare(b.weight(), a.weight()));
    return evidence.subList(0, Math.min(limit, evidence.size()));
  }

  private double logLikelihood(String token, String label) {
    Map<String, Double> row = counts.get(token);
    double count = row == null ? 0 : row.getOrDefault(label, 0.0);
    double vocabulary = Math.max(1, counts.size());
    return StrictMath.log((count + ALPHA) / (totals.get(label) + ALPHA * vocabulary));
  }
}
