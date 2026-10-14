package app.nemmail.api.ai.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The Java ports against what the TS models answer (packages/shared/fixtures/ai/models.json,
 * written by apps/mobile fixtures.test.ts), trained on the same shared corpora.
 */
class ModelFixturesTest {

  private static final double CLOSE = 1e-9;
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static Corpora corpora;
  private static JsonNode expected;

  @BeforeAll
  static void load() throws IOException {
    corpora = JSON.readValue(resource(Corpora.RESOURCE), Corpora.class);
    expected = JSON.readTree(resource("shared/ai/models.json"));
  }

  @Test
  void tokenizesLikeTheSharedTextHelpers() {
    for (JsonNode c : expected.get("tokenize")) {
      JsonNode input = c.get("input");
      assertThat(
              Text.tokenize(
                  input.get("text").asString(),
                  input.get("removeStopwords").asBoolean(),
                  input.get("minLength").asInt()))
          .as(input.get("text").asString())
          .isEqualTo(strings(c.get("tokens")));
    }
  }

  @Test
  void spamMatchesNaiveBayesAndThePhishingRules() {
    NaiveBayes model = SpamModel.train(corpora.spamTraining());
    JsonNode spam = expected.get("spam");
    for (JsonNode c : spam.get("cases")) {
      JsonNode in = c.get("input");
      Phishing.Input input =
          new Phishing.Input(
              in.get("fromName").asString(),
              in.get("fromEmail").asString(),
              in.get("subject").asString(),
              in.get("bodyText").asString(),
              in.get("bodyHtml").isNull() ? null : in.get("bodyHtml").asString());
      assertInsight(
          c.get("verdict"),
          SpamModel.classify(model, input),
          value -> {
            assertThat(value.isSpam())
                .isEqualTo(c.get("verdict").get("value").get("isSpam").asBoolean());
            assertThat(value.isPhishing())
                .isEqualTo(c.get("verdict").get("value").get("isPhishing").asBoolean());
          });
    }
    List<Corpora.SpamSample> eval = corpora.spamEval();
    for (int i = 0; i < eval.size(); i++) {
      assertThat(SpamModel.probability(model, eval.get(i).text()))
          .as(eval.get(i).text())
          .isCloseTo(spam.get("evalProbabilities").get(i).asDouble(), within(CLOSE));
    }
    JsonNode feedback = spam.get("feedback");
    String text = feedback.get("text").asString();
    assertThat(SpamModel.probability(model, text))
        .isCloseTo(feedback.get("before").asDouble(), within(CLOSE));
    SpamModel.learnFeedback(model, text, true);
    assertThat(SpamModel.probability(model, text))
        .isCloseTo(feedback.get("after").asDouble(), within(CLOSE));
  }

  @Test
  void categoryMatchesOnTheHeldOutSamples() {
    NaiveBayes model = CategoryModel.train(corpora.categories(), corpora.categoryTraining());
    for (JsonNode c : expected.get("category").get("cases")) {
      JsonNode in = c.get("input");
      CategoryModel.Input input =
          new CategoryModel.Input(
              in.get("fromEmail").asString(),
              in.get("subject").asString(),
              in.get("bodyText").asString());
      assertInsight(
          c.get("verdict"),
          CategoryModel.classify(model, input),
          value -> assertThat(value).isEqualTo(c.get("verdict").get("value").asString()));
    }
  }

  @Test
  void priorityTrainsTheSameSeedModelAndLearnsTheSameWay() {
    PriorityModel.Logistic model = PriorityModel.seed();
    JsonNode priority = expected.get("priority");
    assertWeights(priority.get("model"), model);
    for (JsonNode c : priority.get("cases")) {
      assertInsight(
          c.get("verdict"),
          PriorityModel.score(model, priorityInput(c.get("input"))),
          value -> assertThat(value).isEqualTo(c.get("verdict").get("value").asDouble()));
    }
    JsonNode feedback = priority.get("feedback");
    PriorityModel.Input marked = priorityInput(feedback.get("input"));
    PriorityModel.learnFeedback(model, marked, true, true);
    assertWeights(feedback, model);
    assertInsight(
        feedback.get("verdict"),
        PriorityModel.score(model, marked),
        value -> assertThat(value).isEqualTo(feedback.get("verdict").get("value").asDouble()));
  }

  @Test
  void composeCompletesTheSamePhrases() {
    NgramModel model = NgramModel.train(corpora.composeSeed());
    JsonNode compose = expected.get("compose");
    assertCompletions(model, compose.get("cases"));
    model.learn(compose.get("learned").get("text").asString(), NgramModel.USER_WEIGHT);
    assertCompletions(model, compose.get("learned").get("cases"));
  }

  @Test
  void summaryPicksTheSameSentencesAndActionItems() {
    for (JsonNode c : expected.get("summary").get("cases")) {
      List<TextRank.Message> messages = new ArrayList<>();
      c.get("messages")
          .forEach(
              m ->
                  messages.add(
                      new TextRank.Message(m.get("from").asString(), m.get("text").asString())));
      List<String> sentences = new ArrayList<>();
      messages.forEach(m -> sentences.addAll(TextRank.splitSentences(m.text())));
      assertThat(sentences).isEqualTo(strings(c.get("sentences")));
      double[] scores = TextRank.textRank(sentences);
      for (int i = 0; i < scores.length; i++) {
        assertThat(scores[i]).isCloseTo(c.get("scores").get(i).asDouble(), within(CLOSE));
      }
      JsonNode verdict = c.get("verdict");
      AiInsight<TextRank.Summary> summary = TextRank.summarize(messages);
      if (verdict.isNull()) {
        assertThat(summary).isNull();
        continue;
      }
      assertInsight(
          verdict,
          summary,
          value -> {
            assertThat(value.text()).isEqualTo(verdict.get("value").get("text").asString());
            assertThat(value.actionItems())
                .isEqualTo(strings(verdict.get("value").get("actionItems")));
          });
    }
  }

  @Test
  void smartRepliesFindTheSameIntent() {
    for (JsonNode c : expected.get("smartReply").get("cases")) {
      JsonNode in = c.get("input");
      AiInsight<SmartReplies.Replies> replies =
          SmartReplies.suggest(
              new SmartReplies.Input(
                  in.get("fromName").asString(),
                  in.get("fromEmail").asString(),
                  in.get("subject").asString(),
                  in.get("text").asString()));
      JsonNode verdict = c.get("verdict");
      if (verdict.isNull()) {
        assertThat(replies).isNull();
        continue;
      }
      assertInsight(
          verdict,
          replies,
          value -> {
            assertThat(value.replies()).isEqualTo(strings(verdict.get("value")));
            assertThat(value.intent())
                .isEqualTo(
                    verdict.get("intent").isNull() ? null : verdict.get("intent").asString());
          });
    }
  }

  @Test
  void extractionFindsTheSameChips() {
    for (JsonNode c : expected.get("extract").get("cases")) {
      JsonNode in = c.get("input");
      AiInsight<List<Extractor.Extraction>> found =
          Extractor.extract(
              new Extractor.Input(
                  in.get("subject").asString(),
                  in.get("text").asString(),
                  Instant.parse(in.get("sentAt").asString())),
              ZoneOffset.UTC);
      JsonNode verdict = c.get("verdict");
      if (verdict.isNull()) {
        assertThat(found).isNull();
        continue;
      }
      assertInsight(
          verdict,
          found,
          value -> {
            List<Extractor.Extraction> chips = new ArrayList<>();
            verdict
                .get("value")
                .forEach(
                    e ->
                        chips.add(
                            new Extractor.Extraction(
                                e.get("kind").asString(),
                                e.get("text").asString(),
                                e.get("value").asString())));
            assertThat(value).isEqualTo(chips);
          });
    }
  }

  private static void assertCompletions(NgramModel model, JsonNode cases) {
    for (JsonNode c : cases) {
      String before = c.get("before").asString();
      AiInsight<String> completion = model.complete(before);
      JsonNode verdict = c.get("verdict");
      if (verdict.isNull()) {
        assertThat(completion).as(before).isNull();
        continue;
      }
      assertInsight(
          verdict,
          completion,
          value -> assertThat(value).as(before).isEqualTo(verdict.get("value").asString()));
    }
  }

  /** Confidence, explanation and source, then the value; "on this device" reads "on the server". */
  private static <T> void assertInsight(JsonNode verdict, AiInsight<T> actual, Consumer<T> value) {
    assertThat(actual).as(verdict.toString()).isNotNull();
    value.accept(actual.value());
    assertThat(actual.confidence()).isEqualTo(verdict.get("confidence").asDouble());
    assertThat(actual.explanation())
        .isEqualTo(
            verdict.get("explanation").asString().replace("on this device", "on the server"));
    assertThat(actual.source()).isEqualTo(verdict.get("source").asString());
  }

  private static void assertWeights(JsonNode expected, PriorityModel.Logistic model) {
    for (int i = 0; i < model.getWeights().length; i++) {
      assertThat(model.getWeights()[i])
          .as("weight %d", i)
          .isCloseTo(expected.get("weights").get(i).asDouble(), within(CLOSE));
    }
    assertThat(model.getBias()).isCloseTo(expected.get("bias").asDouble(), within(CLOSE));
  }

  private static PriorityModel.Input priorityInput(JsonNode in) {
    return new PriorityModel.Input(
        in.get("fromEmail").asString(),
        in.get("subject").asString(),
        in.get("text").asString(),
        in.get("isDirect").asBoolean(),
        in.get("recipientCount").asInt(),
        in.get("messageCount").asInt(),
        in.get("category").isNull() ? null : in.get("category").asString(),
        in.get("hasAttachments").asBoolean(),
        in.get("senderFrequency").asInt());
  }

  private static List<String> strings(JsonNode array) {
    List<String> out = new ArrayList<>();
    array.forEach(node -> out.add(node.asString()));
    return out;
  }

  private static InputStream resource(String path) {
    InputStream in = ModelFixturesTest.class.getClassLoader().getResourceAsStream(path);
    assertThat(in).as(path).isNotNull();
    return in;
  }
}
