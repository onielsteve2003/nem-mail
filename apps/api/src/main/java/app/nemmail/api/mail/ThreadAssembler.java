package app.nemmail.api.mail;

import app.nemmail.api.mail.ThreadResponse.AttachmentResponse;
import app.nemmail.api.mail.ThreadResponse.MessageResponse;
import app.nemmail.api.mail.ThreadSummaryResponse.Address;
import app.nemmail.api.mail.ThreadSummaryResponse.AttachmentPreview;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Loads a user's threads with a fixed number of queries and folds their entries (one per message)
 * into the thread-level state the client sees. Callers hold a read transaction for the labels.
 */
@Component
class ThreadAssembler {

  /** One thread as this user sees it: only the messages they have an entry for, oldest first. */
  record Loaded(
      MailThread thread,
      List<MailboxEntry> entries,
      List<Message> messages,
      Map<UUID, List<MessageRecipient>> recipients,
      Map<UUID, List<Attachment>> attachments) {}

  private final MailThreadRepository threads;
  private final MailboxEntryRepository entries;
  private final MessageRepository messages;
  private final MessageRecipientRepository recipients;
  private final AttachmentRepository attachments;

  ThreadAssembler(
      MailThreadRepository threads,
      MailboxEntryRepository entries,
      MessageRepository messages,
      MessageRecipientRepository recipients,
      AttachmentRepository attachments) {
    this.threads = threads;
    this.entries = entries;
    this.messages = messages;
    this.recipients = recipients;
    this.attachments = attachments;
  }

  /** The user's threads among {@code threadIds}, in that order; unknown ids are skipped. */
  List<Loaded> load(UUID userId, Collection<UUID> threadIds) {
    if (threadIds.isEmpty()) {
      return List.of();
    }
    List<MailboxEntry> found =
        entries.findByUserIdAndThreadIdInAndDeletedAtIsNull(userId, threadIds);
    Set<UUID> messageIds =
        found.stream().map(MailboxEntry::getMessageId).collect(Collectors.toSet());
    Map<UUID, Message> messagesById =
        messages.findAllById(messageIds).stream()
            .collect(Collectors.toMap(Message::getId, Function.identity()));
    Map<UUID, List<MessageRecipient>> recipientsByMessage =
        recipients.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(MessageRecipient::getMessageId));
    Map<UUID, List<Attachment>> attachmentsByMessage =
        attachments.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(Attachment::getMessageId));
    Map<UUID, MailThread> threadsById =
        threads.findAllById(threadIds).stream()
            .collect(Collectors.toMap(MailThread::getId, Function.identity()));
    Map<UUID, List<MailboxEntry>> entriesByThread =
        found.stream().collect(Collectors.groupingBy(MailboxEntry::getThreadId));
    Comparator<MailboxEntry> bySentAt =
        Comparator.comparing((MailboxEntry e) -> messagesById.get(e.getMessageId()).getSentAt())
            .thenComparing(MailboxEntry::getMessageId);
    return threadIds.stream()
        .distinct()
        .filter(entriesByThread::containsKey)
        .map(
            id -> {
              List<MailboxEntry> threadEntries =
                  entriesByThread.get(id).stream().sorted(bySentAt).toList();
              return new Loaded(
                  threadsById.get(id),
                  threadEntries,
                  threadEntries.stream().map(e -> messagesById.get(e.getMessageId())).toList(),
                  recipientsByMessage,
                  attachmentsByMessage);
            })
        .toList();
  }

  /**
   * The list row. Flags are thread-wide (bulk ops set them on every entry), so any entry having one
   * means the thread has it; the thread is unread while any message is.
   */
  ThreadSummaryResponse summary(Loaded loaded) {
    List<MailboxEntry> threadEntries = loaded.entries();
    List<Message> threadMessages = loaded.messages();
    Message latest = threadMessages.getLast();
    EnumSet<Mailbox> filed = EnumSet.noneOf(Mailbox.class);
    Set<UUID> labelIds = new LinkedHashSet<>();
    threadEntries.forEach(
        entry -> {
          if (entry.getMailbox() != null) {
            filed.add(entry.getMailbox());
          }
          labelIds.addAll(entry.getLabelIds());
        });
    return new ThreadSummaryResponse(
        loaded.thread().getId(),
        loaded.thread().getSubject(),
        latest.getSnippet(),
        distinct(threadMessages.stream().map(ThreadAssembler::sender).toList()),
        distinct(
            threadMessages.stream()
                .flatMap(m -> loaded.recipients().getOrDefault(m.getId(), List.of()).stream())
                .filter(r -> r.getKind() != RecipientKind.BCC)
                .map(r -> new Address(r.getEmail(), r.getName()))
                .toList()),
        threadEntries.size(),
        threadEntries.getLast().getLastMessageAt(),
        filed.stream().map(Wire::name).toList(),
        Wire.name(
            threadEntries.reversed().stream()
                .map(MailboxEntry::getCategory)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null)),
        List.copyOf(labelIds),
        threadEntries.stream().anyMatch(e -> !e.isRead()),
        threadEntries.stream().anyMatch(MailboxEntry::isStarred),
        threadEntries.stream().anyMatch(MailboxEntry::isImportant),
        threadEntries.stream().anyMatch(MailboxEntry::isMuted),
        threadEntries.stream()
            .map(MailboxEntry::getSnoozedUntil)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null),
        threadMessages.stream()
            .flatMap(m -> loaded.attachments().getOrDefault(m.getId(), List.of()).stream())
            .map(a -> new AttachmentPreview(a.getFilename(), a.getMime()))
            .toList());
  }

  /** The summary plus every message the user has, oldest first. */
  ThreadResponse thread(UUID userId, Loaded loaded) {
    List<MessageResponse> threadMessages = new ArrayList<>();
    for (int i = 0; i < loaded.messages().size(); i++) {
      Message message = loaded.messages().get(i);
      List<MessageRecipient> to = loaded.recipients().getOrDefault(message.getId(), List.of());
      // Bcc is the sender's secret; other recipients must not learn it.
      boolean mine = userId.equals(message.getFromUserId());
      threadMessages.add(
          new MessageResponse(
              message.getId(),
              message.getThreadId(),
              sender(message),
              addresses(to, RecipientKind.TO),
              addresses(to, RecipientKind.CC),
              mine ? addresses(to, RecipientKind.BCC) : List.of(),
              message.getSubject(),
              message.getBodyHtml(),
              message.getBodyText(),
              message.getSnippet(),
              message.getSentAt(),
              message.getSendAt(),
              Wire.name(message.getStatus()),
              message.getInReplyTo(),
              loaded.attachments().getOrDefault(message.getId(), List.of()).stream()
                  .map(
                      a ->
                          new AttachmentResponse(
                              a.getId(), a.getFilename(), a.getMime(), a.getSize()))
                  .toList(),
              loaded.entries().get(i).isRead(),
              message.getAi()));
    }
    return new ThreadResponse(summary(loaded), threadMessages);
  }

  static Address sender(Message message) {
    return new Address(message.getFromEmail(), message.getFromName());
  }

  private static List<Address> addresses(List<MessageRecipient> recipients, RecipientKind kind) {
    return recipients.stream()
        .filter(r -> r.getKind() == kind)
        .map(r -> new Address(r.getEmail(), r.getName()))
        .toList();
  }

  /** First occurrence of each address, ignoring case, as toSummary does. */
  private static List<Address> distinct(List<Address> addresses) {
    Map<String, Address> seen = new LinkedHashMap<>();
    addresses.forEach(a -> seen.putIfAbsent(a.email().toLowerCase(Locale.ROOT), a));
    return List.copyOf(seen.values());
  }
}
