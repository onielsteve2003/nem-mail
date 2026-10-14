package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Smart replies (AI-4), a port of {@code smart-reply.ts}: intent by keyword evidence, templates.
 */
public final class SmartReplies {

  /** The message being replied to. {@code fromName} is empty when unknown. */
  public record Input(String fromName, String fromEmail, String subject, String text) {}

  /** Three replies and the detected intent (null when nothing stood out). */
  public record Replies(List<String> replies, String intent) {}

  private record Signals(List<String> words, List<Pattern> phrases) {}

  private static Pattern ci(String regex) {
    return Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
  }

  /** In order: earlier intents win ties, so a meeting question is a meeting. */
  private static final List<String> ORDER =
      List.of(
          "meeting",
          "invitation",
          "approval",
          "request",
          "question",
          "thanks",
          "congrats",
          "update");

  private static final Map<String, Signals> SIGNALS =
      Map.of(
          "meeting",
          new Signals(
              List.of(
                  "meet",
                  "meeting",
                  "call",
                  "schedule",
                  "available",
                  "availability",
                  "calendar",
                  "slot",
                  "sync"),
              List.of(
                  ci("\\b(does|would) .{0,20}(work for you|suit you)\\b"),
                  ci("\\bfree (on|at|for)\\b"))),
          "invitation",
          new Signals(
              List.of(
                  "invite",
                  "invited",
                  "invitation",
                  "party",
                  "dinner",
                  "lunch",
                  "rsvp",
                  "celebrate",
                  "join"),
              List.of(ci("\\bjoin us\\b"), ci("\\bwould you like to come\\b"))),
          "approval",
          new Signals(
              List.of("approve", "approval", "sign", "confirm", "okay", "greenlight"),
              List.of(
                  ci("\\bsign[- ]off\\b"),
                  ci("\\bok to (go|proceed|ship)\\b"),
                  ci("\\bgood to go\\b"))),
          "request",
          new Signals(
              List.of("please", "send", "review", "share", "need", "update"),
              List.of(ci("\\b(can|could|would) you\\b"), ci("\\blet me know\\b"))),
          "question",
          new Signals(List.of(), List.of(Pattern.compile("\\b\\w+(?: \\w+){0,3}\\?"))),
          "thanks",
          new Signals(
              List.of("thanks", "thank", "appreciate", "grateful"), List.of(ci("\\bthank you\\b"))),
          "congrats",
          new Signals(
              List.of(
                  "congratulations", "congrats", "promoted", "promotion", "milestone", "launched"),
              List.of(ci("\\bwelcome (to|aboard)\\b"))),
          "update",
          new Signals(
              List.of("fyi", "heads", "update", "shipped", "done", "finished", "attached"),
              List.of(ci("\\bheads up\\b"), ci("\\bjust (wanted to )?let you know\\b"))));

  private static final Map<String, String> OFFERS =
      Map.of(
          "meeting", "a meeting request, so the replies accept, ask for another time, or decline",
          "invitation", "an invitation, so the replies accept, maybe, or decline",
          "approval", "a request for approval, so the replies approve, ask a question, or hold",
          "request", "a request, so the replies agree, set a time, or ask for details",
          "question", "a question, so the replies answer yes, no, or not sure yet",
          "thanks", "a thank-you, so the replies acknowledge it",
          "congrats", "good news, so the replies say thanks",
          "update", "an update, so the replies acknowledge it");

  /** {@code {name}} is the sender's first name. */
  private static final Map<String, List<String>> TEMPLATES =
      Map.of(
          "meeting",
          List.of(
              "Sounds good, see you then!",
              "Could we find another time?",
              "Sorry, I can't make it."),
          "invitation",
          List.of(
              "I'd love to come, thanks {name}!",
              "Maybe, I’ll let you know soon.",
              "Sorry, I can't make it this time."),
          "approval",
          List.of(
              "Approved, go ahead.",
              "I have a couple of questions first.",
              "Let's hold off for now."),
          "request",
          List.of(
              "Sure, I’ll take care of it.",
              "I’ll get back to you by tomorrow.",
              "Could you share more details?"),
          "question",
          List.of("Yes, that works.", "No, I don't think so.", "Let me check and get back to you."),
          "thanks",
          List.of("You're welcome, {name}!", "Happy to help!", "Anytime!"),
          "congrats",
          List.of(
              "Thank you so much, {name}!",
              "Thanks, really appreciate it!",
              "Thanks! It was a team effort."),
          "update",
          List.of(
              "Thanks for the update, {name}!",
              "Got it, thanks!",
              "Great, thanks for letting me know."));

  private static final List<String> GENERIC =
      List.of("Thanks, {name}!", "Got it, thanks!", "I’ll get back to you soon.");

  private static final Pattern NO_REPLY =
      ci("no-?reply|do-?not-?reply|notifications?@|mailer-daemon");
  private static final Pattern BULK = ci("\\bunsubscribe\\b");
  private static final Pattern NAME = Pattern.compile("^[\\p{L}'-]+\\z");
  private static final Pattern NAME_SLOT = Pattern.compile(",? \\{name\\}");

  private SmartReplies() {}

  private static String firstName(String name) {
    String first = name.strip().split("[" + Text.WS + "]+", -1)[0];
    return NAME.matcher(first).find() ? first : "";
  }

  private static String fill(String template, String name) {
    return name.isEmpty()
        ? NAME_SLOT.matcher(template).replaceAll("")
        : template.replace("{name}", name);
  }

  /** The intent with the most evidence; ties go to the earlier intent. */
  static Intent detectIntent(Input input) {
    String text = input.subject() + "\n" + input.text();
    Set<String> words = new HashSet<>(Text.tokenize(text));
    String bestIntent = null;
    List<String> bestEvidence = List.of();
    int total = 0;
    for (String intent : ORDER) {
      Signals signals = SIGNALS.get(intent);
      List<String> evidence = new ArrayList<>();
      signals.words().stream().filter(words::contains).forEach(evidence::add);
      for (Pattern phrase : signals.phrases()) {
        Matcher matcher = phrase.matcher(text);
        if (matcher.find()) {
          evidence.add(matcher.group());
        }
      }
      total += evidence.size();
      if (evidence.size() > bestEvidence.size()) {
        bestIntent = intent;
        bestEvidence = evidence;
      }
    }
    return new Intent(
        bestIntent, bestEvidence, total > 0 ? (double) bestEvidence.size() / total : 0);
  }

  record Intent(String intent, List<String> evidence, double share) {}

  /** Three short replies, or null for mail nobody replies to (no-reply senders, bulk mail). */
  public static AiInsight<Replies> suggest(Input input) {
    if (NO_REPLY.matcher(input.fromEmail()).find() || BULK.matcher(input.text()).find()) {
      return null;
    }
    String name = firstName(input.fromName());
    Intent found = detectIntent(input);
    List<String> replies =
        (found.intent() == null ? GENERIC : TEMPLATES.get(found.intent()))
            .stream().map(template -> fill(template, name)).toList();
    Set<String> unique = new LinkedHashSet<>();
    found.evidence().forEach(e -> unique.add(e.toLowerCase(Locale.ROOT)));
    String quoted = String.join(", ", unique.stream().limit(3).map(e -> "“" + e + "”").toList());
    return new AiInsight<>(
        new Replies(replies, found.intent()),
        found.intent() == null ? 0.4 : AiInsight.round(0.5 + 0.4 * found.share()),
        found.intent() == null
            ? "Nothing specific stood out, so these are general replies."
            : "It reads as " + OFFERS.get(found.intent()) + " (from " + quoted + ").",
        AiInsight.HEURISTIC);
  }
}
