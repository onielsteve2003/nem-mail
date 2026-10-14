package app.nemmail.api.mail;

import app.nemmail.api.auth.User;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Sending (FR-5.6): a draft becomes a message in the sender's Outbox, delivered after the undo
 * window by the task scheduler, or in Scheduled for a later time (the sweeper delivers those).
 * Until then {@link #cancel} turns it back into a draft.
 */
@Service
public class SendService {

  static final Duration UNDO_WINDOW = Duration.ofSeconds(5);

  private final UserRepository users;
  private final MailThreadRepository threads;
  private final MessageRepository messages;
  private final MessageRecipientRepository recipients;
  private final MailboxEntryRepository entries;
  private final DraftService drafts;
  private final DeliveryService delivery;
  private final TaskScheduler scheduler;

  SendService(
      UserRepository users,
      MailThreadRepository threads,
      MessageRepository messages,
      MessageRecipientRepository recipients,
      MailboxEntryRepository entries,
      DraftService drafts,
      DeliveryService delivery,
      TaskScheduler scheduler) {
    this.users = users;
    this.threads = threads;
    this.messages = messages;
    this.recipients = recipients;
    this.entries = entries;
    this.drafts = drafts;
    this.delivery = delivery;
    this.scheduler = scheduler;
  }

  @Transactional
  public SendRequest.Response send(UUID userId, SendRequest request) {
    DraftBody draft = request.draft();
    draft.checkMode();
    if (draft.to().size() + draft.cc().size() + draft.bcc().size() == 0) {
      throw Wire.invalid("draft.to", "Add at least one recipient.");
    }
    User sender = users.findById(userId).orElseThrow();
    boolean scheduled = request.sendAt() != null;
    // Postgres keeps microseconds, so the time the client gets back matches the stored one.
    Instant sendAt =
        (scheduled ? request.sendAt() : Instant.now().plus(UNDO_WINDOW))
            .truncatedTo(ChronoUnit.MILLIS);

    UUID threadId = drafts.ownThread(userId, draft.threadId());
    if (threadId == null) {
      threadId = threads.save(new MailThread(UUID.randomUUID(), draft.subject(), sendAt)).getId();
    }
    String text = HtmlText.text(draft.bodyHtml());
    Message message =
        new Message(
            UUID.randomUUID(),
            threadId,
            sender.getEmail(),
            sender.getName(),
            draft.subject(),
            text,
            HtmlText.snippet(text),
            sendAt,
            scheduled ? MessageStatus.SCHEDULED : MessageStatus.OUTBOX);
    message.setFromUserId(userId);
    message.setBodyHtml(draft.bodyHtml());
    message.setSendAt(sendAt);
    message.setInReplyTo(inReplyTo(threadId, draft.inReplyTo()));
    messages.save(message);
    addRecipients(message.getId(), draft.to(), RecipientKind.TO);
    addRecipients(message.getId(), draft.cc(), RecipientKind.CC);
    addRecipients(message.getId(), draft.bcc(), RecipientKind.BCC);

    MailboxEntry entry =
        new MailboxEntry(
            UUID.randomUUID(),
            userId,
            message.getId(),
            threadId,
            scheduled ? Mailbox.SCHEDULED : Mailbox.OUTBOX,
            null,
            sendAt);
    entry.setRead(true);
    entries.save(entry);
    drafts.discard(userId, draft.id());

    if (!scheduled) {
      UUID messageId = message.getId();
      afterCommit(() -> scheduler.schedule(() -> delivery.deliver(messageId, sendAt), sendAt));
    }
    return new SendRequest.Response(message.getId(), threadId, sendAt);
  }

  /**
   * Undo send or cancel a scheduled one: the message is deleted and comes back as a new draft. A
   * message already delivered is a 409; another user's is a 404.
   */
  @Transactional
  public DraftBody cancel(UUID userId, UUID messageId) {
    Message message =
        messages
            .lockById(messageId)
            .filter(m -> userId.equals(m.getFromUserId()))
            .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Message not found."));
    if (message.getStatus() == MessageStatus.SENT) {
      throw new ApiException(ErrorCode.CONFLICT, "This message was already sent.");
    }
    List<MessageRecipient> sentTo = recipients.findByMessageId(messageId);
    boolean threadHasMore = messages.existsByThreadIdAndIdNot(message.getThreadId(), messageId);
    UUID draftId = UUID.randomUUID();
    DraftBody draft =
        new DraftBody(
            draftId.toString(),
            message.getInReplyTo() != null ? "reply" : "new",
            threadHasMore ? message.getThreadId().toString() : null,
            message.getInReplyTo() != null ? message.getInReplyTo().toString() : null,
            addresses(sentTo, RecipientKind.TO),
            addresses(sentTo, RecipientKind.CC),
            addresses(sentTo, RecipientKind.BCC),
            message.getSubject(),
            message.getBodyHtml() != null ? message.getBodyHtml() : "",
            List.of(),
            null,
            null);
    messages.delete(message);
    if (!threadHasMore) {
      threads.deleteById(message.getThreadId());
    }
    messages.flush();
    return drafts.save(userId, draftId, draft);
  }

  /** Only a message of the same thread can be replied to; anything else starts no chain. */
  private UUID inReplyTo(UUID threadId, String raw) {
    if (raw == null) {
      return null;
    }
    try {
      UUID id = UUID.fromString(raw);
      return messages
          .findById(id)
          .filter(m -> m.getThreadId().equals(threadId))
          .map(Message::getId)
          .orElse(null);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private void addRecipients(UUID messageId, List<DraftBody.Address> to, RecipientKind kind) {
    to.forEach(
        address ->
            recipients.save(
                new MessageRecipient(
                    UUID.randomUUID(),
                    messageId,
                    address.email(),
                    address.name(),
                    users.findByEmailIgnoreCase(address.email()).map(User::getId).orElse(null),
                    kind)));
  }

  private static List<DraftBody.Address> addresses(
      List<MessageRecipient> sentTo, RecipientKind kind) {
    return sentTo.stream()
        .filter(r -> r.getKind() == kind)
        .map(r -> new DraftBody.Address(r.getEmail(), r.getName()))
        .toList();
  }

  private static void afterCommit(Runnable task) {
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            task.run();
          }
        });
  }
}
