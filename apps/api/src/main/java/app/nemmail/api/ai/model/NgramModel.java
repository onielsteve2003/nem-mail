package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Smart compose (AI-5), a port of {@code ngram.ts}: a word trigram model with stupid backoff,
 * trained on the user's sent mail plus a seed corpus. {@code counts} has the TS model's shape:
 * context (0 to 2 lowercase tokens) → next token → count.
 */
public record NgramModel(int version, String kind, Map<String, Map<String, Double>> counts) {

  private static final String START = "<s>";
  private static final int ORDER = 3;
  private static final double BACKOFF = 0.4;
  private static final double MIN_PROBABILITY = 0.3;
  private static final int MAX_WORDS = 5;

  /** Sent mail says more about how the user writes than the seed corpus does. */
  public static final double USER_WEIGHT = 3;

  private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9]+(?:['’][A-Za-z]+)*|[.,!?;:]");
  private static final Pattern END = Pattern.compile("^[.!?]\\z");
  private static final Pattern PUNCTUATION = Pattern.compile("^[.,!?;:]\\z");
  private static final Pattern LINE_BREAK = Pattern.compile("\\r?\\n");
  private static final Pattern MID_WORD = Pattern.compile("[A-Za-z0-9']\\z");
  private static final Pattern TRAILING_SPACE = Pattern.compile("[" + Text.WS + "]\\z");

  private record Guess(String token, double probability) {}

  public static NgramModel empty() {
    return new NgramModel(1, "ngram", new LinkedHashMap<>());
  }

  /** A model trained on the seed sentences only. */
  public static NgramModel train(List<String> seed) {
    NgramModel model = empty();
    seed.forEach(sentence -> model.learn(sentence, 1));
    return model;
  }

  /** Tokens with a start marker at each line and sentence start. */
  public static List<String> composeTokens(String text) {
    List<String> tokens = new ArrayList<>();
    for (String line : LINE_BREAK.split(text, -1)) {
      List<String> words = new ArrayList<>();
      Matcher matcher = TOKEN.matcher(line);
      while (matcher.find()) {
        words.add(matcher.group());
      }
      if (words.isEmpty()) {
        continue;
      }
      tokens.add(START);
      for (int i = 0; i < words.size(); i++) {
        tokens.add(words.get(i));
        if (isEnd(words.get(i)) && i < words.size() - 1) {
          tokens.add(START);
        }
      }
    }
    return tokens;
  }

  private static String key(List<String> context) {
    return String.join(" ", context.stream().map(t -> t.toLowerCase(Locale.ROOT)).toList());
  }

  private static boolean isEnd(String token) {
    return END.matcher(token).find();
  }

  /** Adds text to the model; quoted replies and the signature are skipped. */
  public void learn(String text, double weight) {
    List<String> tokens = composeTokens(TextRank.ownText(text));
    for (int i = 0; i < tokens.size(); i++) {
      String token = tokens.get(i);
      if (token.equals(START)) {
        continue;
      }
      for (int n = 0; n < ORDER && i - n >= 0; n++) {
        counts
            .computeIfAbsent(key(tokens.subList(i - n, i)), k -> new LinkedHashMap<>())
            .merge(token, weight, Double::sum);
      }
    }
  }

  /** Backs off from the trigram to the bigram; the unigram only finishes a started word. */
  private Guess bestNext(List<String> context, String prefix) {
    String lower = prefix.toLowerCase(Locale.ROOT);
    int lowest = prefix.length() >= 2 ? 0 : 1;
    double discount = 1;
    for (int n = Math.min(ORDER - 1, context.size()); n >= lowest; n--) {
      Map<String, Double> next =
          counts.get(key(context.subList(context.size() - n, context.size())));
      if (next != null) {
        double total = 0;
        String bestToken = null;
        double bestCount = 0;
        for (Map.Entry<String, Double> entry : next.entrySet()) {
          String token = entry.getKey();
          if (!token.toLowerCase(Locale.ROOT).startsWith(lower)
              || token.length() <= prefix.length()) {
            continue;
          }
          total += entry.getValue();
          if (bestToken == null || entry.getValue() > bestCount) {
            bestToken = token;
            bestCount = entry.getValue();
          }
        }
        if (bestToken != null) {
          return new Guess(bestToken, (bestCount / total) * discount);
        }
      }
      discount *= BACKOFF;
    }
    return null;
  }

  /** Ghost text for the text before the caret, or null when no guess is likely enough. */
  public AiInsight<String> complete(String before) {
    String text = before.replace(' ', ' ');
    if (text.isBlank()) {
      return null;
    }
    List<String> tokens = composeTokens(text);
    boolean isMidWord = MID_WORD.matcher(text).find();
    String prefix = isMidWord && !tokens.isEmpty() ? tokens.removeLast() : "";
    if (isMidWord && prefix.length() < 2) {
      return null;
    }
    List<String> context = new ArrayList<>(tokens);
    if (!isMidWord && !context.isEmpty() && isEnd(context.getLast())) {
      context.add(START);
    }
    StringBuilder suffix = new StringBuilder();
    double confidence = 1;
    int words = 0;
    String partial = prefix;
    while (words < MAX_WORDS) {
      Guess guess = bestNext(context, partial);
      if (guess == null || guess.probability() < MIN_PROBABILITY) {
        break;
      }
      String piece = partial.isEmpty() ? guess.token() : guess.token().substring(partial.length());
      boolean isFirst = suffix.isEmpty() && !isMidWord;
      boolean glued =
          !partial.isEmpty()
              || PUNCTUATION.matcher(guess.token()).find()
              || (isFirst && TRAILING_SPACE.matcher(text).find());
      suffix.append(glued ? "" : " ").append(piece);
      confidence *= guess.probability();
      context.add(guess.token());
      partial = "";
      words += 1;
      if (isEnd(guess.token())) {
        break;
      }
    }
    if (suffix.toString().strip().length() < 2) {
      return null;
    }
    return new AiInsight<>(
        suffix.toString(),
        AiInsight.round(confidence),
        "Predicted from phrases you often write in sent mail. Press Tab to accept.",
        AiInsight.MODEL);
  }
}
