package app.nemmail.api.ai;

import app.nemmail.api.ai.model.AiInsight;
import app.nemmail.api.ai.model.Extractor;
import app.nemmail.api.ai.model.SmartReplies;
import app.nemmail.api.ai.model.TextRank;
import app.nemmail.api.auth.User;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.MailboxView;
import app.nemmail.api.mail.ThreadFilter;
import app.nemmail.api.mail.ThreadResponse;
import app.nemmail.api.mail.ThreadResponse.MessageResponse;
import app.nemmail.api.mail.ThreadService;
import app.nemmail.api.mail.ThreadSummaryResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The AI assistant (AI-11): "Summarize unread", "What needs a reply?" and "Draft a reply", built
 * from the summary (AI-3), smart reply (AI-4) and priority (AI-6) results as the app builds them in
 * apps/mobile src/lib/ai/assistant.ts. The prompt is free text, so its words pick the answer.
 * Anything else goes to the local LLM when one runs (development only), or gets a short help.
 */
@Service
class Assistant {

  /** Inbox rows read for "Summarize unread". */
  static final int UNREAD_PAGE = 100;

  /** How many conversations an answer lists. */
  static final int ITEMS = 5;

  /** Recent Primary conversations checked for "What needs a reply?". */
  static final int REPLY_CANDIDATES = 15;

  static final Duration REPLY_WINDOW = Duration.ofDays(14);

  private static final int DETAIL_MAX = 140;
  private static final String NO_DRAFT_REPLY =
      "Thanks for your message. I'll get back to you soon.";
  static final String HELP =
      "I can summarize your unread mail, tell you what needs a reply, or draft a reply."
          + " Try \"Summarize my unread\".";

  private static final Pattern DRAFT = Pattern.compile("\\b(draft|write|compose)\\b");
  private static final Pattern UNREAD = Pattern.compile("\\b(unread|summari[sz]e|catch me up)\\b");
  private static final Pattern NEEDS_REPLY =
      Pattern.compile("\\b(repl(y|ies)|respond|answer|waiting)\\b");
  private static final Pattern SENTENCE = Pattern.compile("^.+?[.!?](?=\\s|$)");

  private static final Map<Category, String> TAB_NAMES =
      Map.of(
          Category.PRIMARY, "Primary",
          Category.PROMOTIONS, "Promotions",
          Category.SOCIAL, "Social",
          Category.UPDATES, "Updates",
          Category.FORUMS, "Forums");

  /** Intents that leave the ball in the user's court, as the app words them. */
  private static final Map<String, String> WAITING =
      Map.of(
          "question", "Asks you a question",
          "request", "Asks you for something",
          "meeting", "Wants to find a time",
          "invitation", "Invites you",
          "approval", "Waiting on your approval");

  private final ThreadService threads;
  private final ThreadAi threadAi;
  private final UserRepository users;
  private final LocalLlm llm;
  private final JsonMapper json;

  Assistant(
      ThreadService threads,
      ThreadAi threadAi,
      UserRepository users,
      LocalLlm llm,
      JsonMapper json) {
    this.threads = threads;
    this.threadAi = threadAi;
    this.users = users;
    this.llm = llm;
    this.json = json;
  }

  AssistantResponse answer(UUID userId, String prompt, UUID threadId) {
    User user = users.findById(userId).orElseThrow();
    String words = prompt.toLowerCase(Locale.ROOT);
    if (DRAFT.matcher(words).find()) {
      return draftReply(user, threadId);
    }
    if (UNREAD.matcher(words).find()) {
      return summarizeUnread(user);
    }
    if (NEEDS_REPLY.matcher(words).find()) {
      return threadId != null ? draftReply(user, threadId) : needsReply(user);
    }
    return open(user, prompt);
  }

  /** The unread inbox by tab, then the most important ones with a one-line summary each. */
  AssistantResponse summarizeUnread(User user) {
    List<ThreadSummaryResponse> unread =
        threads
            .list(
                user.getId(),
                new ThreadFilter.InMailbox(MailboxView.INBOX, null),
                null,
                UNREAD_PAGE)
            .items()
            .stream()
            .filter(ThreadSummaryResponse::isUnread)
            .toList();
    List<String> lines = new ArrayList<>();
    lines.add(unreadIntro(unread));
    List<ThreadResponse> top =
        mostImportant(unread, ITEMS).stream()
            .map(row -> threads.get(user.getId(), row.id()))
            .toList();
    for (ThreadResponse thread : top) {
      TextRank.Summary summary = threadAi.summary(user.getId(), thread.summary().id()).value();
      lines.add(item(thread, user.getEmail(), oneLine(summary.text())));
    }
    return answer(lines, top);
  }

  /** Recent direct Primary mail whose last message, from someone else, waits on the user. */
  AssistantResponse needsReply(User user) {
    List<Waiting> waiting = waitingOn(user);
    List<String> lines = new ArrayList<>();
    lines.add(needsReplyIntro(waiting.size()));
    List<Waiting> shown = waiting.stream().limit(ITEMS).toList();
    shown.forEach(w -> lines.add(item(w.thread(), user.getEmail(), w.reason())));
    return answer(lines, shown.stream().map(Waiting::thread).toList());
  }

  /** A whole reply from the top smart reply, to the given thread or the first one waiting. */
  AssistantResponse draftReply(User user, UUID threadId) {
    String self = user.getEmail().toLowerCase(Locale.ROOT);
    ThreadResponse thread =
        threadId != null
            ? threads.get(user.getId(), threadId)
            : waitingOn(user).stream().findFirst().map(Waiting::thread).orElse(null);
    MessageResponse message =
        thread == null ? null : lastFromSomeoneElse(thread, self).orElse(null);
    if (message == null) {
      return new AssistantResponse(
          threadId != null
              ? "This conversation has no message from someone else to reply to."
              : "Nothing needs a reply right now, so there is nothing to draft.",
          threadId != null ? List.of(threadId) : List.of(),
          List.of());
    }
    List<String> replies = threadAi.replies(user.getId(), thread.summary().id()).value();
    String sender = name(message.from());
    String subject = blankTo(thread.summary().subject(), "(no subject)");
    String draft =
        draftText(
            replies.isEmpty() ? NO_DRAFT_REPLY : replies.getFirst(),
            Optional.ofNullable(message.from().name()).orElse(""),
            Optional.ofNullable(user.getName()).orElse(""));
    return new AssistantResponse(
        "Here is a draft reply to " + sender + " about “" + subject + "”:\n\n" + draft,
        List.of(thread.summary().id()),
        extractions(List.of(message)));
  }

  /** Any other question: the local LLM over the unread subjects, or the help line. */
  private AssistantResponse open(User user, String prompt) {
    if (!llm.available()) {
      return new AssistantResponse(HELP, List.of(), List.of());
    }
    List<ThreadSummaryResponse> recent =
        threads
            .list(
                user.getId(), new ThreadFilter.InMailbox(MailboxView.INBOX, null), null, ITEMS * 2)
            .items();
    String context =
        recent.stream()
            .map(row -> "- " + row.subject() + ": " + row.snippet())
            .collect(Collectors.joining("\n"));
    return llm.generate(
            "You are an email assistant. Answer briefly using only these inbox conversations:\n"
                + context
                + "\n\nQuestion: "
                + prompt)
        .map(
            text ->
                new AssistantResponse(
                    text.trim(),
                    recent.stream().map(ThreadSummaryResponse::id).toList(),
                    List.of()))
        .orElse(new AssistantResponse(HELP, List.of(), List.of()));
  }

  private record Waiting(ThreadResponse thread, String reason) {}

  private List<Waiting> waitingOn(User user) {
    String self = user.getEmail().toLowerCase(Locale.ROOT);
    Instant since = Instant.now().minus(REPLY_WINDOW);
    List<ThreadSummaryResponse> recent =
        threads
            .list(
                user.getId(),
                new ThreadFilter.InMailbox(MailboxView.INBOX, Category.PRIMARY),
                null,
                50)
            .items()
            .stream()
            .filter(row -> !row.lastMessageAt().isBefore(since))
            .toList();
    List<Waiting> waiting = new ArrayList<>();
    for (ThreadSummaryResponse row : mostImportant(recent, REPLY_CANDIDATES)) {
      ThreadResponse thread = threads.get(user.getId(), row.id());
      MessageResponse last = thread.messages().getLast();
      if (!"sent".equals(last.status())
          || mine(last, self)
          || last.to().stream().noneMatch(to -> to.email().toLowerCase(Locale.ROOT).equals(self))) {
        continue;
      }
      AiInsight<SmartReplies.Replies> verdict =
          SmartReplies.suggest(
              new SmartReplies.Input(
                  Optional.ofNullable(last.from().name()).orElse(""),
                  last.from().email(),
                  last.subject(),
                  last.bodyText()));
      String reason = verdict == null ? null : WAITING.get(verdict.value().intent());
      if (reason != null) {
        waiting.add(new Waiting(thread, reason));
      }
    }
    return waiting;
  }

  /** The {@code limit} most important rows: priority score when stored, else list order. */
  private List<ThreadSummaryResponse> mostImportant(List<ThreadSummaryResponse> rows, int limit) {
    Map<UUID, Double> scores = new LinkedHashMap<>();
    rows.forEach(row -> scores.put(row.id(), priority(row)));
    return rows.stream()
        .sorted(
            Comparator.comparingDouble((ThreadSummaryResponse row) -> scores.get(row.id()))
                .reversed())
        .limit(limit)
        .toList();
  }

  private double priority(ThreadSummaryResponse row) {
    double fallback = row.isImportant() ? 0.6 : 0;
    if (row.ai() == null) {
      return fallback;
    }
    try {
      return json.readTree(row.ai()).path("priority").path("value").asDouble(fallback);
    } catch (JacksonException e) {
      return fallback;
    }
  }

  private AssistantResponse answer(List<String> lines, List<ThreadResponse> drawnOn) {
    return new AssistantResponse(
        String.join("\n", lines),
        drawnOn.stream().map(thread -> thread.summary().id()).toList(),
        extractions(drawnOn.stream().map(thread -> thread.messages().getLast()).toList()));
  }

  /** Dates, meetings, tracking numbers and codes in these messages, once each, at most four. */
  private static List<Extractor.Extraction> extractions(List<MessageResponse> messages) {
    Set<Extractor.Extraction> found = new LinkedHashSet<>();
    for (MessageResponse message : messages) {
      AiInsight<List<Extractor.Extraction>> extracted =
          Extractor.extract(
              new Extractor.Input(message.subject(), message.bodyText(), message.sentAt()),
              ZoneOffset.UTC);
      if (extracted != null) {
        found.addAll(extracted.value());
      }
    }
    return found.stream().limit(Extractor.MAX_EXTRACTIONS).toList();
  }

  /** "You have 12 unread conversations: 4 in Primary and 8 in Promotions." */
  static String unreadIntro(List<ThreadSummaryResponse> unread) {
    if (unread.isEmpty()) {
      return "You're all caught up. Nothing unread in your inbox.";
    }
    List<String> parts = new ArrayList<>();
    String only = null;
    for (Category category : Category.values()) {
      String key = category.name().toLowerCase(Locale.ROOT);
      long count =
          unread.stream().filter(row -> key.equals(blankTo(row.category(), "primary"))).count();
      if (count > 0) {
        parts.add(count + " in " + TAB_NAMES.get(category));
        only = TAB_NAMES.get(category);
      }
    }
    String noun = unread.size() == 1 ? "conversation" : "conversations";
    String where = parts.size() > 1 ? ": " + joinAnd(parts) : " in " + only;
    String top = unread.size() > 1 ? " The ones that look most important:" : "";
    return "You have " + unread.size() + " unread " + noun + where + "." + top;
  }

  static String needsReplyIntro(int count) {
    if (count == 0) {
      return "Nothing in your inbox seems to be waiting on you. Nice.";
    }
    return count == 1
        ? "One conversation looks like it needs a reply:"
        : count + " conversations look like they need a reply:";
  }

  /** A short reply grown into a whole message: greeting, the reply, sign-off. */
  static String draftText(String reply, String toName, String selfName) {
    String greeting = toName.isBlank() ? "Hi," : "Hi " + firstName(toName) + ",";
    String signOff = selfName.isBlank() ? "Best," : "Best,\n" + firstName(selfName);
    return greeting + "\n\n" + reply + "\n\n" + signOff;
  }

  /** First sentence of a text, cut to one line. */
  static String oneLine(String text) {
    String flat = text.replaceAll("\\s+", " ").strip();
    var sentence = SENTENCE.matcher(flat);
    String first = sentence.find() ? sentence.group() : flat;
    return first.length() > DETAIL_MAX
        ? first.substring(0, DETAIL_MAX - 1).stripTrailing() + "…"
        : first;
  }

  /** "• Ada · Lunch Friday? — Asks you a question" */
  private static String item(ThreadResponse thread, String selfEmail, String detail) {
    String self = selfEmail.toLowerCase(Locale.ROOT);
    List<ThreadSummaryResponse.Address> participants = thread.summary().participants();
    ThreadSummaryResponse.Address sender =
        participants.reversed().stream()
            .filter(p -> !p.email().toLowerCase(Locale.ROOT).equals(self))
            .findFirst()
            .orElse(participants.isEmpty() ? null : participants.getFirst());
    String name = sender == null ? "" : name(sender);
    return "• "
        + name
        + " · "
        + blankTo(thread.summary().subject(), "(no subject)")
        + " — "
        + detail;
  }

  private static Optional<MessageResponse> lastFromSomeoneElse(ThreadResponse thread, String self) {
    return thread.messages().reversed().stream()
        .filter(m -> "sent".equals(m.status()) && !mine(m, self))
        .findFirst();
  }

  private static boolean mine(MessageResponse message, String self) {
    return message.from().email().toLowerCase(Locale.ROOT).equals(self);
  }

  private static String name(ThreadSummaryResponse.Address address) {
    return blankTo(address.name(), address.email());
  }

  private static String blankTo(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String firstName(String name) {
    return name.strip().split("\\s+")[0];
  }

  private static String joinAnd(List<String> parts) {
    return parts.size() <= 1
        ? parts.isEmpty() ? "" : parts.getFirst()
        : String.join(", ", parts.subList(0, parts.size() - 1)) + " and " + parts.getLast();
  }
}
