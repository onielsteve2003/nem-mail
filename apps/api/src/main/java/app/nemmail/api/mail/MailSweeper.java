package app.nemmail.api.mail;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Delivers due Outbox and Scheduled mail and wakes due snoozes. It runs on a timer while the
 * instance is awake, and on requests (at most every {@link #REQUEST_GAP}) because the free host
 * sleeps: the first request after it wakes catches up before it is answered.
 */
@Component
public class MailSweeper {

  static final Duration REQUEST_GAP = Duration.ofSeconds(15);
  private static final Logger log = LoggerFactory.getLogger(MailSweeper.class);

  private final MessageRepository messages;
  private final DeliveryService delivery;
  private final ThreadOpsService ops;

  /** When the last sweep started; package-private so tests can make the next request sweep. */
  final AtomicReference<Instant> lastSweep = new AtomicReference<>(Instant.EPOCH);

  MailSweeper(MessageRepository messages, DeliveryService delivery, ThreadOpsService ops) {
    this.messages = messages;
    this.delivery = delivery;
    this.ops = ops;
  }

  @Scheduled(fixedDelay = 30, timeUnit = TimeUnit.SECONDS)
  void sweepWhileAwake() {
    sweep(Instant.now());
  }

  /** The on-request sweep; skipped when another one ran in the last {@link #REQUEST_GAP}. */
  public void sweepIfStale() {
    Instant now = Instant.now();
    Instant last = lastSweep.get();
    if (now.isBefore(last.plus(REQUEST_GAP)) || !lastSweep.compareAndSet(last, now)) {
      return;
    }
    try {
      sweep(now);
    } catch (RuntimeException e) {
      // The request itself still gets its answer; the timer retries.
      log.warn("On-request sweep failed", e);
    }
  }

  /** One pass at {@code now}; each message is delivered in its own transaction. */
  public void sweep(Instant now) {
    lastSweep.accumulateAndGet(now, (a, b) -> a.isAfter(b) ? a : b);
    int delivered = 0;
    for (UUID id :
        messages.findDueIds(EnumSet.of(MessageStatus.OUTBOX, MessageStatus.SCHEDULED), now)) {
      try {
        if (delivery.deliver(id, now)) {
          delivered++;
        }
      } catch (RuntimeException e) {
        log.warn("Delivery of message {} failed; the next sweep retries", id, e);
      }
    }
    int woke = ops.wakeDue(now);
    if (delivered + woke > 0) {
      log.info("Sweep delivered {} message(s) and woke {} snoozed thread(s)", delivered, woke);
    }
  }
}
