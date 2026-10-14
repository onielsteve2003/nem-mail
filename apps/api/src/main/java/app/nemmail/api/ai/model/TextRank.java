package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Extractive thread summaries (AI-3), a port of {@code textrank.ts}: TextRank over TF-IDF sentence
 * similarity, plus action items. Abstractive summaries stay on the device.
 */
public final class TextRank {

  /** One message as the summarizer reads it: who wrote it and its plain text. */
  public record Message(String from, String text) {}

  public record Summary(String text, List<String> actionItems) {}

  public static final int SUMMARY_SENTENCES = 2;
  public static final int MIN_SUMMARY_SENTENCES = 3;
  private static final int MAX_ACTION_ITEMS = 3;
  private static final double DAMPING = 0.85;
  private static final int ITERATIONS = 30;

  private static final Pattern LINE_BREAK = Pattern.compile("\\r?\\n");
  private static final Pattern QUOTE = Pattern.compile("^[" + Text.WS + "]*>");
  private static final Pattern REPLY_HEADER =
      Pattern.compile(
          "^[" + Text.WS + "]*on .+wrote:[" + Text.WS + "]*\\z", Pattern.CASE_INSENSITIVE);
  private static final Pattern SIGNATURE =
      Pattern.compile(
          "^[" + Text.WS + "]*(--[" + Text.WS + "]*|sent from my .+)\\z", Pattern.CASE_INSENSITIVE);
  private static final Pattern FILLER =
      Pattern.compile(
          "^(hi|hello|hey|dear|thanks|thank you|cheers|best|regards|best regards|kind"
              + " regards|warmly|sincerely)\\b[^.!?]{0,30}[,!.]?\\z",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern ACTION =
      Pattern.compile(
          "\\b(please|can you|could you|would you|need to|needs to|make sure|don't forget|remember"
              + " to|let me know|action required|by"
              + " (monday|tuesday|wednesday|thursday|friday|tomorrow|tonight|eod|end of day|the end"
              + " of))\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern SENTENCE_BREAK =
      Pattern.compile("\\n+|(?<=[.!?])[" + Text.WS + "]+(?=[A-Z0-9\"'(])");
  private static final Pattern SPACES = Pattern.compile("[" + Text.WS + "]+");
  private static final Pattern LEAD_IN =
      Pattern.compile("^(also|and|so),?[" + Text.WS + "]+", Pattern.CASE_INSENSITIVE);

  private TextRank() {}

  /** The writer's own text: everything above the quoted reply, minus signatures. */
  public static String ownText(String text) {
    List<String> kept = new ArrayList<>();
    for (String line : LINE_BREAK.split(text, -1)) {
      if (REPLY_HEADER.matcher(line).find() || SIGNATURE.matcher(line).find()) {
        break;
      }
      if (!QUOTE.matcher(line).find()) {
        kept.add(line);
      }
    }
    return String.join("\n", kept);
  }

  /** Sentences of the writer's own text, minus greetings, sign-offs and fragments. */
  public static List<String> splitSentences(String text) {
    List<String> sentences = new ArrayList<>();
    for (String part : SENTENCE_BREAK.split(ownText(text), -1)) {
      String sentence = SPACES.matcher(part).replaceAll(" ").strip();
      if (Text.tokenize(sentence).size() >= 3 && !FILLER.matcher(sentence).find()) {
        sentences.add(sentence);
      }
    }
    return sentences;
  }

  /** TextRank centrality of each sentence (PageRank power iteration over cosine similarity). */
  public static double[] textRank(List<String> sentences) {
    int count = sentences.size();
    if (count == 0) {
      return new double[0];
    }
    List<List<String>> tokens =
        sentences.stream().map(sentence -> Text.tokenize(sentence, true, 2)).toList();
    Map<String, Double> idf = Text.inverseDocumentFrequency(tokens);
    List<Map<String, Double>> vectors =
        tokens.stream().map(t -> Text.tfidfVector(t, idf, count)).toList();
    double[][] weights = new double[count][count];
    double[] outgoing = new double[count];
    for (int i = 0; i < count; i++) {
      for (int j = 0; j < count; j++) {
        weights[i][j] = i == j ? 0 : Text.cosineSimilarity(vectors.get(i), vectors.get(j));
        outgoing[i] += weights[i][j];
      }
    }
    double[] scores = new double[count];
    java.util.Arrays.fill(scores, 1.0 / count);
    for (int iteration = 0; iteration < ITERATIONS; iteration++) {
      double[] next = new double[count];
      for (int i = 0; i < count; i++) {
        double rank = 0;
        for (int j = 0; j < count; j++) {
          if (outgoing[j] > 0) {
            rank += (weights[j][i] / outgoing[j]) * scores[j];
          }
        }
        next[i] = (1 - DAMPING) / count + DAMPING * rank;
      }
      scores = next;
    }
    return scores;
  }

  /** Requests and to-dos, newest message first, each with who asked. */
  public static List<String> actionItems(List<Message> messages) {
    List<String> items = new ArrayList<>();
    for (Message message : messages.reversed()) {
      for (String sentence : splitSentences(message.text())) {
        if (!ACTION.matcher(sentence).find()) {
          continue;
        }
        String item = message.from() + ": " + LEAD_IN.matcher(sentence).replaceFirst("");
        if (!items.contains(item)) {
          items.add(item);
        }
        if (items.size() == MAX_ACTION_ITEMS) {
          return items;
        }
      }
    }
    return items;
  }

  /** The most central sentences in reading order, plus action items; null for short threads. */
  public static AiInsight<Summary> summarize(List<Message> messages) {
    List<String> sentences = new ArrayList<>();
    messages.forEach(message -> sentences.addAll(splitSentences(message.text())));
    if (sentences.size() < MIN_SUMMARY_SENTENCES) {
      return null;
    }
    double[] scores = textRank(sentences);
    List<Integer> picked = new ArrayList<>();
    for (int i = 0; i < scores.length; i++) {
      picked.add(i);
    }
    picked.sort(
        Comparator.<Integer>comparingDouble(i -> -scores[i]).thenComparingInt(Integer::intValue));
    picked = new ArrayList<>(picked.subList(0, SUMMARY_SENTENCES));
    picked.sort(Comparator.naturalOrder());
    double share = 0;
    for (int index : picked) {
      share += scores[index];
    }
    double even = (double) SUMMARY_SENTENCES / sentences.size();
    return new AiInsight<>(
        new Summary(
            String.join(" ", picked.stream().map(sentences::get).toList()), actionItems(messages)),
        AiInsight.round(Math.min(0.95, Math.max(0.3, 0.5 + share - even))),
        "TextRank picked the "
            + SUMMARY_SENTENCES
            + " most central of "
            + sentences.size()
            + " sentences, on the server. Action items are sentences that ask for something.",
        AiInsight.MODEL);
  }
}
