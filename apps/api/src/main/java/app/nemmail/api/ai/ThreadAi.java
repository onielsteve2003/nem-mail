package app.nemmail.api.ai;

import app.nemmail.api.ai.model.AiInsight;
import app.nemmail.api.ai.model.SmartReplies;
import app.nemmail.api.ai.model.TextRank;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.mail.ThreadResponse;
import app.nemmail.api.mail.ThreadResponse.MessageResponse;
import app.nemmail.api.mail.ThreadService;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/**
 * Thread summaries (AI-3, extractive TextRank; DistilBART stays on the device) and smart replies
 * (AI-4, intent templates), as the app makes them. Each is cached per user and thread until the
 * thread gets a new message. A thread too short to summarize, or with nothing to reply to, gets a
 * heuristic answer instead, so the client always has something to show.
 */
@Service
public class ThreadAi {

  /** "You" for the user's own messages, as in the app. */
  static final String YOU = "You";

  /** Past this many entries the cache starts over; a summary costs milliseconds to redo. */
  private static final int CACHE_LIMIT = 1000;

  private record Key(UUID userId, UUID threadId, String kind) {}

  /** {@code version} is the thread's message count and latest message id. */
  private record Cached(String version, AiInsight<?> value) {}

  private final ThreadService threads;
  private final UserRepository users;
  private final Map<Key, Cached> cache = new ConcurrentHashMap<>();

  ThreadAi(ThreadService threads, UserRepository users) {
    this.threads = threads;
    this.users = users;
  }

  /** The thread's summary with action items; 404 when the user does not have it. */
  public AiInsight<TextRank.Summary> summary(UUID userId, UUID threadId) {
    ThreadResponse thread = threads.get(userId, threadId);
    String self = email(userId);
    return cached(
        new Key(userId, threadId, "summary"),
        thread,
        () -> {
          List<TextRank.Message> messages =
              thread.messages().stream()
                  .map(
                      message ->
                          new TextRank.Message(
                              mine(message, self)
                                  ? YOU
                                  : Optional.ofNullable(message.from().name())
                                      .filter(name -> !name.isBlank())
                                      .orElse(message.from().email()),
                              message.bodyText()))
                  .toList();
          AiInsight<TextRank.Summary> summary = TextRank.summarize(messages);
          return summary != null ? summary : opening(thread, messages);
        });
  }

  /** Three replies to the latest message from someone else; none for mail nobody answers. */
  public AiInsight<List<String>> replies(UUID userId, UUID threadId) {
    ThreadResponse thread = threads.get(userId, threadId);
    String self = email(userId);
    return cached(
        new Key(userId, threadId, "replies"),
        thread,
        () -> {
          MessageResponse latest =
              thread.messages().reversed().stream()
                  .filter(message -> !mine(message, self))
                  .findFirst()
                  .orElse(null);
          if (latest == null) {
            return none("Every message here is yours, so there is nothing to reply to yet.");
          }
          AiInsight<SmartReplies.Replies> suggested =
              SmartReplies.suggest(
                  new SmartReplies.Input(
                      Optional.ofNullable(latest.from().name()).orElse(""),
                      latest.from().email(),
                      latest.subject(),
                      latest.bodyText()));
          if (suggested == null) {
            return none("No replies for this one: it comes from a no-reply sender or bulk mail.");
          }
          return new AiInsight<>(
              suggested.value().replies(),
              suggested.confidence(),
              suggested.explanation(),
              suggested.source());
        });
  }

  @SuppressWarnings("unchecked")
  private <T> AiInsight<T> cached(Key key, ThreadResponse thread, Supplier<AiInsight<T>> compute) {
    String version = thread.messages().size() + ":" + thread.messages().getLast().id();
    Cached hit = cache.get(key);
    if (hit != null && hit.version().equals(version)) {
      return (AiInsight<T>) hit.value();
    }
    AiInsight<T> value = compute.get();
    if (cache.size() >= CACHE_LIMIT) {
      cache.clear();
    }
    cache.put(key, new Cached(version, value));
    return value;
  }

  /** The non-AI fallback: the latest message's first sentence (or its snippet). */
  private static AiInsight<TextRank.Summary> opening(
      ThreadResponse thread, List<TextRank.Message> messages) {
    MessageResponse latest = thread.messages().getLast();
    String text =
        TextRank.splitSentences(latest.bodyText()).stream().findFirst().orElse(latest.snippet());
    return new AiInsight<>(
        new TextRank.Summary(text, TextRank.actionItems(messages)),
        0.3,
        "Too short to summarize, so this is how the latest message begins.",
        AiInsight.HEURISTIC);
  }

  private static AiInsight<List<String>> none(String explanation) {
    return new AiInsight<>(List.of(), 1, explanation, AiInsight.HEURISTIC);
  }

  private static boolean mine(MessageResponse message, String self) {
    return message.from().email().toLowerCase(Locale.ROOT).equals(self);
  }

  private String email(UUID userId) {
    return users.findById(userId).orElseThrow().getEmail().toLowerCase(Locale.ROOT);
  }
}
