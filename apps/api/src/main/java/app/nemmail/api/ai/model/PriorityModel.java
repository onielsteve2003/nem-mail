package app.nemmail.api.ai.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Priority (AI-6), a port of {@code priority-lr.ts}: logistic regression written from scratch,
 * seeded from the same simulated engagement (same PRNG and seed) as the app's model.
 */
public final class PriorityModel {

  /** What the model reads about one message. {@code category} may be null. */
  public record Input(
      String fromEmail,
      String subject,
      String text,
      boolean isDirect,
      int recipientCount,
      int messageCount,
      String category,
      boolean hasAttachments,
      int senderFrequency) {}

  /** Same JSON shape as the TS model: {@code version, kind, weights, bias}. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static final class Logistic {
    private final double[] weights;
    private double bias;

    @JsonCreator
    public Logistic(@JsonProperty("weights") double[] weights, @JsonProperty("bias") double bias) {
      this.weights = weights;
      this.bias = bias;
    }

    public int getVersion() {
      return 1;
    }

    public String getKind() {
      return "logistic";
    }

    public double[] getWeights() {
      return weights;
    }

    public double getBias() {
      return bias;
    }
  }

  public record Sample(double[] x, int y) {}

  /** At or above this score a message gets the Important marker. */
  public static final double IMPORTANT_THRESHOLD = 0.6;

  /** Why each feature (in vector order) pushes the score. */
  public static final List<String> REASONS =
      List.of(
          "you have written to this sender",
          "you mail with them often",
          "it was sent to you directly",
          "it went to only a few people",
          "it mentions a deadline or urgency",
          "it asks you something",
          "it is a conversation with replies",
          "it looks like bulk mail",
          "it has attachments",
          "it is an automated update");

  private static final Pattern URGENT =
      Pattern.compile(
          "\\b(urgent|asap|deadline|today|tonight|eod|action required|time[- ]sensitive|overdue|immediately)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern REQUEST =
      Pattern.compile(
          "\\?|\\b(can you|could you|please|let me know|thoughts|review|approve|sign)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern BULK_SENDER =
      Pattern.compile(
          "no-?reply|newsletter|notifications?@|marketing|digest@|news@", Pattern.CASE_INSENSITIVE);
  private static final Pattern UNSUBSCRIBE =
      Pattern.compile("\\bunsubscribe\\b", Pattern.CASE_INSENSITIVE);
  private static final Set<String> BULK_TABS = Set.of("promotions", "social", "forums");
  private static final double FREQUENCY_CAP = 30;

  private static final double[] SIMULATED_WEIGHTS = {
    1.2, 1.6, 1.1, 0.6, 1.2, 0.9, 0.8, -2.4, 0.3, -0.9
  };
  private static final double SIMULATED_BIAS = -1.6;

  private static final int MARK_STEPS = 40;
  private static final int OPEN_STEPS = 1;
  private static final double FEEDBACK_RATE = 0.3;
  private static final double FEEDBACK_MARGIN = 0.1;

  private PriorityModel() {}

  /** The feature vector, each value from 0 to 1. */
  public static double[] features(Input input) {
    String text = input.subject() + "\n" + input.text();
    boolean isBulk =
        (input.category() != null && BULK_TABS.contains(input.category()))
            || BULK_SENDER.matcher(input.fromEmail()).find()
            || UNSUBSCRIBE.matcher(input.text()).find();
    return new double[] {
      input.senderFrequency() > 0 ? 1 : 0,
      Math.min(1, StrictMath.log1p(input.senderFrequency()) / StrictMath.log1p(FREQUENCY_CAP)),
      input.isDirect() ? 1 : 0,
      input.recipientCount() <= 2 ? 1 : 0,
      URGENT.matcher(text).find() ? 1 : 0,
      REQUEST.matcher(text).find() ? 1 : 0,
      input.messageCount() > 1 ? 1 : 0,
      isBulk ? 1 : 0,
      input.hasAttachments() ? 1 : 0,
      "updates".equals(input.category()) ? 1 : 0
    };
  }

  private static double sigmoid(double z) {
    return 1 / (1 + StrictMath.exp(-z));
  }

  public static double predict(Logistic model, double[] x) {
    double z = model.bias;
    for (int i = 0; i < x.length; i++) {
      z += (i < model.weights.length ? model.weights[i] : 0) * x[i];
    }
    return sigmoid(z);
  }

  /** Batch gradient descent on the log loss with an L2 penalty (300 epochs, rate 0.5). */
  public static Logistic train(List<Sample> samples, int size) {
    int epochs = 300;
    double rate = 0.5;
    double l2 = 0.001;
    Logistic model = new Logistic(new double[size], 0);
    double total = samples.isEmpty() ? 1 : samples.size();
    for (int epoch = 0; epoch < epochs; epoch++) {
      double[] grad = new double[size];
      double gradBias = 0;
      for (Sample sample : samples) {
        double error = predict(model, sample.x()) - sample.y();
        for (int i = 0; i < size; i++) {
          grad[i] = grad[i] + error * (i < sample.x().length ? sample.x()[i] : 0);
        }
        gradBias += error;
      }
      for (int i = 0; i < size; i++) {
        double w = model.weights[i];
        model.weights[i] = w - rate * (grad[i] / total + l2 * w);
      }
      model.bias -= (rate * gradBias) / total;
    }
    return model;
  }

  /** mulberry32, so the seed model is the same on every device and on the server. */
  private static final class Mulberry32 {
    private int a;

    Mulberry32(int seed) {
      a = seed;
    }

    double next() {
      a += 0x6d2b79f5;
      int t = a;
      t = (t ^ (t >>> 15)) * (t | 1);
      t ^= t + (t ^ (t >>> 7)) * (t | 61);
      return Integer.toUnsignedLong(t ^ (t >>> 14)) / 4294967296.0;
    }

    int flip(double p) {
      return next() < p ? 1 : 0;
    }
  }

  /** Simulated engagement for a fresh account: who a typical user opens and replies to. */
  public static List<Sample> simulateEngagement(int count, int seed) {
    Mulberry32 random = new Mulberry32(seed);
    List<Sample> samples = new ArrayList<>(count);
    for (int n = 0; n < count; n++) {
      int bulk = random.flip(0.45);
      int known = bulk == 1 ? random.flip(0.05) : random.flip(0.55);
      double[] x = new double[10];
      x[0] = known;
      x[1] = known == 1 ? random.next() : 0;
      x[2] = bulk == 1 ? random.flip(0.2) : random.flip(0.8);
      x[3] = bulk == 1 ? random.flip(0.1) : random.flip(0.6);
      x[4] = random.flip(bulk == 1 ? 0.15 : 0.2);
      x[5] = random.flip(bulk == 1 ? 0.2 : 0.45);
      x[6] = bulk == 1 ? 0 : random.flip(0.35);
      x[7] = bulk;
      x[8] = random.flip(0.15);
      x[9] = bulk == 1 ? random.flip(0.2) : random.flip(0.15);
      double z = SIMULATED_BIAS;
      for (int i = 0; i < x.length; i++) {
        z += SIMULATED_WEIGHTS[i] * x[i];
      }
      samples.add(new Sample(x, random.next() < sigmoid(z) ? 1 : 0));
    }
    return samples;
  }

  /** The starting model, trained on 600 simulated messages (seed 7). */
  public static Logistic seed() {
    return train(simulateEngagement(600, 7), REASONS.size());
  }

  private static String joinReasons(List<String> reasons) {
    if (reasons.size() > 1) {
      return String.join(", ", reasons.subList(0, reasons.size() - 1))
          + " and "
          + reasons.getLast();
    }
    return reasons.isEmpty() ? "" : reasons.getFirst();
  }

  /** Scores a message from 0 (ignore) to 1 (important), with the features that moved it most. */
  public static AiInsight<Double> score(Logistic model, Input input) {
    double[] x = features(input);
    double score = predict(model, x);
    boolean isImportant = score >= IMPORTANT_THRESHOLD;
    record Pull(int index, double pull) {}
    List<Pull> pulls = new ArrayList<>();
    for (int i = 0; i < x.length; i++) {
      double pull = x[i] * model.weights[i];
      if (isImportant ? pull > 0.05 : pull < -0.05) {
        pulls.add(new Pull(i, pull));
      }
    }
    Comparator<Pull> strongest = Comparator.comparingDouble(Pull::pull);
    pulls.sort(isImportant ? strongest.reversed() : strongest);
    List<String> reasons = pulls.stream().limit(2).map(pull -> REASONS.get(pull.index())).toList();
    String explanation =
        isImportant
            ? "Important because " + joinReasons(reasons) + "."
            : reasons.isEmpty()
                ? "Not marked important: nothing in it stood out, like a familiar sender or a"
                    + " request."
                : "Not marked important because " + joinReasons(reasons) + ".";
    return new AiInsight<>(
        AiInsight.round(score),
        AiInsight.round(Math.max(score, 1 - score)),
        explanation,
        AiInsight.MODEL);
  }

  /**
   * Learns from the user: a mark ({@code marked}) keeps stepping until the message lands past the
   * threshold with a margin; an open is a single small step.
   */
  public static void learnFeedback(
      Logistic model, Input input, boolean isImportant, boolean marked) {
    double[] x = features(input);
    int y = isImportant ? 1 : 0;
    int steps = marked ? MARK_STEPS : OPEN_STEPS;
    for (int step = 0; step < steps; step++) {
      double score = predict(model, x);
      boolean settled =
          isImportant
              ? score >= IMPORTANT_THRESHOLD + FEEDBACK_MARGIN
              : score < IMPORTANT_THRESHOLD - FEEDBACK_MARGIN;
      if (marked && settled) {
        break;
      }
      double error = score - y;
      for (int i = 0; i < x.length; i++) {
        model.weights[i] = model.weights[i] - FEEDBACK_RATE * error * x[i];
      }
      model.bias -= FEEDBACK_RATE * error;
    }
  }
}
