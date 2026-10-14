package app.nemmail.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.ai.model.CategoryModel;
import app.nemmail.api.ai.model.Corpora;
import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.SpamModel;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * The server's models on the held-out sets, with the app's gates (spam-nb.test.ts and
 * category.test.ts): spam at least 90% accurate, inbox tabs at least 80%. The seed models must
 * pass, and so must a user's models after feedback and a trip through their stored JSON.
 */
class ModelEvaluationTest {

  static final double SPAM_GATE = 0.9;
  static final double CATEGORY_GATE = 0.8;

  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static SeedModels seed;
  private static Corpora corpora;

  @BeforeAll
  static void load() {
    seed = new SeedModels(JSON);
    corpora = seed.corpora();
  }

  record SpamScore(double accuracy, double precision, double recall, int total) {}

  /** As evaluateSpam in the app: spam when the probability reaches the threshold. */
  static SpamScore spam(NaiveBayes model, List<Corpora.SpamSample> samples) {
    int tp = 0;
    int fp = 0;
    int fn = 0;
    int correct = 0;
    for (Corpora.SpamSample sample : samples) {
      boolean predicted = SpamModel.probability(model, sample.text()) >= SpamModel.THRESHOLD;
      if (predicted == sample.isSpam()) {
        correct++;
      }
      if (predicted && sample.isSpam()) {
        tp++;
      } else if (predicted) {
        fp++;
      } else if (sample.isSpam()) {
        fn++;
      }
    }
    return new SpamScore(
        (double) correct / samples.size(),
        tp + fp == 0 ? 1 : (double) tp / (tp + fp),
        tp + fn == 0 ? 1 : (double) tp / (tp + fn),
        samples.size());
  }

  /** As evaluateCategory in the app: rules and model together, as classify answers. */
  static double category(NaiveBayes model, List<Corpora.CategorySample> samples) {
    long correct =
        samples.stream()
            .filter(
                s ->
                    CategoryModel.classify(model, CategoryModel.input(s))
                        .value()
                        .equals(s.category()))
            .count();
    return (double) correct / samples.size();
  }

  @Test
  void seedSpamModelReachesTheGate() {
    SpamScore score = spam(seed.spam(), corpora.spamEval());
    System.out.printf(
        "spam eval: accuracy %.3f, precision %.3f, recall %.3f (n=%d)%n",
        score.accuracy(), score.precision(), score.recall(), score.total());
    assertThat(score.total()).isPositive();
    assertThat(score.accuracy()).isGreaterThanOrEqualTo(SPAM_GATE);
  }

  @Test
  void seedCategoryModelReachesTheGate() {
    double accuracy = category(seed.category(), corpora.categoryEval());
    System.out.printf(
        "category eval: accuracy %.3f (n=%d)%n", accuracy, corpora.categoryEval().size());
    assertThat(accuracy).isGreaterThanOrEqualTo(CATEGORY_GATE);
  }

  @Test
  void personalModelsLearnFeedbackAndKeepTheGates() {
    NaiveBayes spam = seed.spam();
    String newsletter = "Weekly digest from the gadget club: new gadget deals inside";
    SpamModel.learnFeedback(spam, newsletter, true);
    SpamModel.learnFeedback(spam, newsletter, true);
    assertThat(SpamModel.probability(spam, newsletter)).isGreaterThanOrEqualTo(0.5);

    NaiveBayes tabs = seed.category();
    CategoryModel.Input club =
        new CategoryModel.Input("ann@club.example", "Club meeting notes", "Agenda for Tuesday.");
    CategoryModel.learnFeedback(tabs, club, "forums");
    CategoryModel.learnFeedback(tabs, club, "forums");
    assertThat(CategoryModel.classify(tabs, club).value()).isEqualTo("forums");

    assertThat(spam(spam, corpora.spamEval()).accuracy()).isGreaterThanOrEqualTo(SPAM_GATE);
    assertThat(category(tabs, corpora.categoryEval())).isGreaterThanOrEqualTo(CATEGORY_GATE);
  }

  @Test
  void storedModelsScoreTheSameAfterAJsonRoundTrip() {
    NaiveBayes spam = seed.spam();
    NaiveBayes tabs = seed.category();
    NaiveBayes spamBack = JSON.readValue(JSON.writeValueAsString(spam), NaiveBayes.class);
    NaiveBayes tabsBack = JSON.readValue(JSON.writeValueAsString(tabs), NaiveBayes.class);
    assertThat(spam(spamBack, corpora.spamEval())).isEqualTo(spam(spam, corpora.spamEval()));
    assertThat(category(tabsBack, corpora.categoryEval()))
        .isEqualTo(category(tabs, corpora.categoryEval()));
  }
}
