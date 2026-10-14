package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.BiPredicate;
import java.util.regex.Pattern;

/** Inbox tabs (AI-1), a port of {@code category.ts}: high-precision rules, then Naive Bayes. */
public final class CategoryModel {

  /** What the model reads from a message. */
  public record Input(String fromEmail, String subject, String bodyText) {}

  /** A user's "Move to tab" counts as this many seed samples. */
  public static final double FEEDBACK_WEIGHT = 3;

  private static final Map<String, String> TAB_NAMES =
      Map.of(
          "primary", "Primary",
          "promotions", "Promotions",
          "social", "Social",
          "updates", "Updates",
          "forums", "Forums");

  private static final Pattern LIST_TAG = Pattern.compile("^\\s*\\[[\\w.-]+\\]");
  private static final Pattern LIST_SENDER = Pattern.compile("^(list|forum|digest|discuss)\\b");
  private static final Pattern LIST_FOOTER =
      Pattern.compile(
          "\\b(reply to|post to) the (list|group)\\b|\\bunsubscribe from this (list|group)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern SOCIAL =
      Pattern.compile(
          "\\b(commented on|tagged you|started following|friend request|wants to connect|invited"
              + " you to connect|mentioned you|new followers?)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern UPDATES =
      Pattern.compile(
          "\\b(order #?\\d+|receipt|statement|invoice|your"
              + " (order|package|parcel|bill|flight|booking)|new sign-?in|password was"
              + " changed|appointment|payment received)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern PROMOTIONS =
      Pattern.compile(
          "\\b\\d+% off\\b|\\bcoupon\\b|\\bpromo code\\b|\\buse code\\b|\\bsale\\b|\\bdeals?\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern PERCENT = Pattern.compile("\\d+%");
  private static final Pattern NUMBER = Pattern.compile("#\\d+");

  private record Rule(String category, String reason, BiPredicate<Input, String> test) {}

  /** Checked in order. Primary has none: it is "a person wrote to you". */
  private static final List<Rule> RULES =
      List.of(
          new Rule(
              "forums",
              "It comes from a mailing list or discussion group.",
              (input, local) ->
                  LIST_TAG.matcher(input.subject()).find()
                      || LIST_SENDER.matcher(local).find()
                      || LIST_FOOTER.matcher(input.bodyText()).find()),
          new Rule(
              "social",
              "It is a notification about people you follow or know online.",
              (input, local) -> SOCIAL.matcher(input.subject() + " " + input.bodyText()).find()),
          new Rule(
              "updates",
              "It is a receipt, order, account or appointment notice.",
              (input, local) -> UPDATES.matcher(input.subject() + " " + input.bodyText()).find()),
          new Rule(
              "promotions",
              "It advertises a sale, discount or coupon.",
              (input, local) ->
                  PROMOTIONS.matcher(input.subject() + " " + input.bodyText()).find()));

  private CategoryModel() {}

  private static String localPart(String email) {
    return email.split("@", -1)[0].toLowerCase(Locale.ROOT);
  }

  /** Content words plus sender and shape markers. */
  public static List<String> features(Input input) {
    List<String> features =
        new ArrayList<>(Text.tokenize(input.subject() + "\n" + input.bodyText(), true, 2));
    Text.tokenize(localPart(input.fromEmail())).forEach(token -> features.add("from:" + token));
    String all = input.subject() + input.bodyText();
    if (LIST_TAG.matcher(input.subject()).find()) {
      features.add("__tag");
    }
    if (PERCENT.matcher(all).find()) {
      features.add("__percent");
    }
    if (NUMBER.matcher(all).find()) {
      features.add("__number");
    }
    return features;
  }

  public static NaiveBayes train(List<String> categories, List<Corpora.CategorySample> samples) {
    NaiveBayes model = NaiveBayes.create(categories);
    for (Corpora.CategorySample sample : samples) {
      model.learn(features(input(sample)), sample.category(), 1);
    }
    return model;
  }

  public static Input input(Corpora.CategorySample sample) {
    return new Input(sample.from(), sample.subject(), sample.body());
  }

  /** Learns from the user moving a conversation to another tab. */
  public static void learnFeedback(NaiveBayes model, Input input, String category) {
    model.learn(features(input), category, FEEDBACK_WEIGHT);
  }

  /** A rule wins unless the model is very sure of something else. */
  public static AiInsight<String> classify(NaiveBayes model, Input input) {
    List<String> features = features(input);
    NaiveBayes.Prediction prediction = model.predict(features);
    double probability = prediction.probabilities().get(prediction.label());
    String local = localPart(input.fromEmail());
    Rule rule = RULES.stream().filter(r -> r.test().test(input, local)).findFirst().orElse(null);

    if (rule != null && (rule.category().equals(prediction.label()) || probability < 0.9)) {
      boolean agrees = rule.category().equals(prediction.label());
      return new AiInsight<>(
          rule.category(),
          AiInsight.round(agrees ? Math.max(0.9, probability) : 0.8),
          rule.reason(),
          agrees ? AiInsight.MODEL : AiInsight.HEURISTIC);
    }
    List<String> words =
        model.explain(features, prediction.label(), 3).stream()
            .map(NaiveBayes.Evidence::token)
            .filter(token -> !token.startsWith("__") && !token.startsWith("from:"))
            .map(token -> "“" + token + "”")
            .toList();
    String tab = TAB_NAMES.get(prediction.label());
    return new AiInsight<>(
        prediction.label(),
        AiInsight.round(probability),
        words.isEmpty()
            ? "It reads most like your " + tab + " mail."
            : "Words like " + String.join(", ", words) + " are typical of " + tab + ".",
        AiInsight.MODEL);
  }
}
