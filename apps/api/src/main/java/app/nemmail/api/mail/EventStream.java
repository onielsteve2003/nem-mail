package app.nemmail.api.mail;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-Sent Events per user, in memory (the API runs as one instance). Each user who opened a
 * stream keeps a short replay buffer, so a client that reconnects with {@code Last-Event-ID} gets
 * what it missed; a fresh {@code counts} event on every connect covers anything older. Event ids
 * grow across restarts (they start from the boot time), and a comment every {@link #HEARTBEAT}
 * keeps proxies from closing an idle stream.
 */
@Component
public class EventStream {

  static final Duration TIMEOUT = Duration.ofMinutes(15);
  static final Duration HEARTBEAT = Duration.ofSeconds(20);
  static final Duration REPLAY_AGE = Duration.ofMinutes(5);
  static final int REPLAY_MAX = 100;
  private static final long RECONNECT_MS = 3000;
  private static final Logger log = LoggerFactory.getLogger(EventStream.class);

  private record Sent(long id, Instant at, ServerEvent event) {}

  /** One user's open emitters and recent events; guarded by its own monitor. */
  private static final class Channel {
    final Set<SseEmitter> emitters = new CopyOnWriteArraySet<>();
    final Deque<Sent> replay = new ArrayDeque<>();
    Instant idleSince = Instant.now();
  }

  private final Map<UUID, Channel> channels = new ConcurrentHashMap<>();
  private final AtomicLong sequence = new AtomicLong(System.currentTimeMillis() * 1000);
  private final ThreadService threads;
  private final CountsService counts;

  EventStream(ThreadService threads, CountsService counts) {
    this.threads = threads;
    this.counts = counts;
  }

  /** Opens a stream: current counts, then anything buffered after {@code lastEventId}. */
  public SseEmitter open(UUID userId, String lastEventId) {
    SseEmitter emitter = new SseEmitter(TIMEOUT.toMillis());
    Channel channel = channels.computeIfAbsent(userId, id -> new Channel());
    Runnable remove = () -> leave(channel, emitter);
    emitter.onCompletion(remove);
    emitter.onTimeout(remove);
    emitter.onError(e -> remove.run());
    Long after = parseId(lastEventId);
    ServerEvent snapshot = new ServerEvent.Counts(counts.counts(userId, Instant.now()));
    synchronized (channel) {
      channel.emitters.add(emitter);
      boolean ok =
          send(emitter, SseEmitter.event().reconnectTime(RECONNECT_MS).comment("connected"))
              && send(emitter, SseEmitter.event().data(snapshot, MediaType.APPLICATION_JSON));
      if (ok && after != null) {
        for (Sent sent : channel.replay) {
          if (sent.id() > after && !send(emitter, event(sent))) {
            break;
          }
        }
      }
    }
    return emitter;
  }

  /** Whether the user has a channel; nobody else's events are worth building. */
  boolean listening(UUID userId) {
    return channels.containsKey(userId);
  }

  /** Buffers the event and sends it to every open stream of the user. */
  void publish(UUID userId, ServerEvent event) {
    Channel channel = channels.get(userId);
    if (channel == null) {
      return;
    }
    synchronized (channel) {
      Sent sent = new Sent(sequence.incrementAndGet(), Instant.now(), event);
      channel.replay.addLast(sent);
      while (channel.replay.size() > REPLAY_MAX) {
        channel.replay.removeFirst();
      }
      channel.emitters.forEach(emitter -> send(emitter, event(sent)));
    }
  }

  @TransactionalEventListener
  @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
  void on(MailEvents.NewMail change) {
    try {
      Instant now = Instant.now();
      for (UUID userId : change.touched()) {
        if (!listening(userId)) {
          continue;
        }
        if (change.inbox().contains(userId)) {
          threads
              .summaries(userId, List.of(change.threadId()))
              .forEach(summary -> publish(userId, new ServerEvent.MailNew(summary)));
        }
        publish(userId, new ServerEvent.Counts(counts.counts(userId, now)));
      }
    } catch (RuntimeException e) {
      // The mail is delivered either way; clients catch up from counts on reconnect.
      log.warn("Could not stream new mail in thread {}", change.threadId(), e);
    }
  }

  @TransactionalEventListener
  @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
  void on(MailEvents.SnoozeWoke woke) {
    UUID userId = woke.userId();
    if (!listening(userId)) {
      return;
    }
    try {
      if (!woke.threadIds().isEmpty()) {
        publish(userId, new ServerEvent.SnoozeWoke(threads.summaries(userId, woke.threadIds())));
      }
      publish(userId, new ServerEvent.Counts(counts.counts(userId, Instant.now())));
    } catch (RuntimeException e) {
      log.warn("Could not stream woken snoozes for user {}", userId, e);
    }
  }

  /** Keeps open streams alive and forgets old events and channels idle past the replay age. */
  @Scheduled(fixedDelay = 20, timeUnit = TimeUnit.SECONDS)
  void heartbeat() {
    Instant cutoff = Instant.now().minus(REPLAY_AGE);
    channels.forEach(
        (userId, channel) -> {
          synchronized (channel) {
            while (!channel.replay.isEmpty() && channel.replay.peekFirst().at().isBefore(cutoff)) {
              channel.replay.removeFirst();
            }
            if (channel.emitters.isEmpty()) {
              if (channel.idleSince.isBefore(cutoff)) {
                channels.remove(userId, channel);
              }
              return;
            }
            channel.emitters.forEach(
                emitter -> send(emitter, SseEmitter.event().comment("heartbeat")));
          }
        });
  }

  private void leave(Channel channel, SseEmitter emitter) {
    synchronized (channel) {
      if (channel.emitters.remove(emitter) && channel.emitters.isEmpty()) {
        channel.idleSince = Instant.now();
      }
    }
  }

  private static SseEmitter.SseEventBuilder event(Sent sent) {
    return SseEmitter.event()
        .id(Long.toString(sent.id()))
        .data(sent.event(), MediaType.APPLICATION_JSON);
  }

  /** False when the client has gone; the emitter is then completed and leaves its channel. */
  private static boolean send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
    try {
      emitter.send(event);
      return true;
    } catch (IOException | IllegalStateException e) {
      emitter.completeWithError(e);
      return false;
    }
  }

  private static Long parseId(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    try {
      return Long.parseLong(raw.strip());
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
