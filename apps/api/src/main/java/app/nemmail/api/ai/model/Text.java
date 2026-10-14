package app.nemmail.api.ai.model;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Port of {@code @nem/shared/text}: normalizing, tokenizing and TF-IDF, so the server's models see
 * the same words as the on-device ones. Maps keep insertion order and math goes through {@link
 * StrictMath} (fdlibm, as in V8), so sums and logs match the TS models to the last digit or so.
 */
public final class Text {

  /** JavaScript's {@code \s}: ASCII whitespace plus the Unicode spaces, for character classes. */
  static final String WS =
      "\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";

  /** Common English words that carry little meaning on their own. */
  public static final Set<String> STOPWORDS =
      Set.copyOf(
          new HashSet<>(
              Arrays.asList(
                  ("a about above after again against all am an and any are as at be because been"
                          + " before being below between both but by can could did do does doing"
                          + " down during each few for from further had has have having he her"
                          + " here hers herself him himself his how i if in into is it its itself"
                          + " just me more most my myself no nor not now of off on once only or"
                          + " other our ours ourselves out over own same she should so some such"
                          + " than that the their theirs them themselves then there these they"
                          + " this those through to too under until up very was we were what when"
                          + " where which while who whom why will with would you your yours"
                          + " yourself yourselves i'm you're it's don't can't won't isn't i'll"
                          + " i've we're let's")
                      .split(" "))));

  private static final Pattern MARKS = Pattern.compile("\\p{M}");
  private static final Pattern CURLY = Pattern.compile("[‘’“”]");
  private static final Pattern SPACES = Pattern.compile("[" + WS + "]+");
  private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+(?:'[\\p{L}\\p{N}]+)*");

  private Text() {}

  /** Lowercases, folds accents, straightens curly quotes and collapses whitespace. */
  public static String normalize(String text) {
    String folded = MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFKD)).replaceAll("");
    String straight =
        CURLY
            .matcher(folded)
            .replaceAll(m -> m.group().equals("‘") || m.group().equals("’") ? "'" : "\"");
    return SPACES.matcher(straight.toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
  }

  /** Normalized word tokens; punctuation, emoji and symbols are dropped. */
  public static List<String> tokenize(String text) {
    return tokenize(text, false, 1);
  }

  public static List<String> tokenize(String text, boolean removeStopwords, int minLength) {
    List<String> tokens = new ArrayList<>();
    Matcher matcher = WORD.matcher(normalize(text));
    while (matcher.find()) {
      String token = matcher.group();
      if (token.length() >= minLength && !(removeStopwords && STOPWORDS.contains(token))) {
        tokens.add(token);
      }
    }
    return tokens;
  }

  /** How often each item occurs, in first-seen order. */
  public static Map<String, Double> countTerms(List<String> terms) {
    Map<String, Double> counts = new LinkedHashMap<>();
    for (String term : terms) {
      counts.merge(term, 1.0, Double::sum);
    }
    return counts;
  }

  /** Smoothed inverse document frequency: {@code ln((1 + N) / (1 + df)) + 1}. */
  public static Map<String, Double> inverseDocumentFrequency(List<List<String>> documents) {
    Map<String, Double> documentFrequency = new LinkedHashMap<>();
    for (List<String> tokens : documents) {
      for (String term : new LinkedHashSet<>(tokens)) {
        documentFrequency.merge(term, 1.0, Double::sum);
      }
    }
    double total = documents.size();
    Map<String, Double> idf = new LinkedHashMap<>();
    documentFrequency.forEach(
        (term, df) -> idf.put(term, StrictMath.log((1 + total) / (1 + df)) + 1));
    return idf;
  }

  /** L2-normalized TF-IDF vector; terms missing from {@code idf} weigh as if in no document. */
  public static Map<String, Double> tfidfVector(
      List<String> tokens, Map<String, Double> idf, int corpusSize) {
    double unseen = StrictMath.log(1 + corpusSize) + 1;
    Map<String, Double> vector = new LinkedHashMap<>();
    countTerms(tokens)
        .forEach((term, count) -> vector.put(term, count * idf.getOrDefault(term, unseen)));
    double length = norm(vector);
    if (length > 0) {
      vector.replaceAll((term, weight) -> weight / length);
    }
    return vector;
  }

  /** Cosine similarity of two sparse vectors. */
  public static double cosineSimilarity(Map<String, Double> a, Map<String, Double> b) {
    Map<String, Double> small = a.size() <= b.size() ? a : b;
    Map<String, Double> large = small == a ? b : a;
    double dot = 0;
    for (Map.Entry<String, Double> entry : small.entrySet()) {
      dot += entry.getValue() * large.getOrDefault(entry.getKey(), 0.0);
    }
    double norms = norm(a) * norm(b);
    return norms == 0 ? 0 : dot / norms;
  }

  private static double norm(Map<String, Double> vector) {
    double sum = 0;
    for (double weight : vector.values()) {
      sum += weight * weight;
    }
    return StrictMath.sqrt(sum);
  }
}
