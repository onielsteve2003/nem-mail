package app.nemmail.api.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Delivers a due Outbox or Scheduled message: it moves to the sender's Sent and lands in the inbox
 * of every Nem Mail recipient. Other addresses go over SMTP when {@code spring.mail.host} is set
 * (Mailpit in development); otherwise, or if SMTP fails, the sender gets a bounce notice.
 */
@Service
public class DeliveryService {

  static final String MAILER_DAEMON = "mailer-daemon@nemmail.app";
  private static final String MESSAGE_ID_DOMAIN = "nemmail.app";
  private static final Set<MessageStatus> PENDING =
      EnumSet.of(MessageStatus.OUTBOX, MessageStatus.SCHEDULED);
  private static final Logger log = LoggerFactory.getLogger(DeliveryService.class);

  private final MailThreadRepository threads;
  private final MessageRepository messages;
  private final MessageRecipientRepository recipients;
  private final MailboxEntryRepository entries;
  private final ContactRepository contacts;
  private final ObjectProvider<JavaMailSender> smtp;

  DeliveryService(
      MailThreadRepository threads,
      MessageRepository messages,
      MessageRecipientRepository recipients,
      MailboxEntryRepository entries,
      ContactRepository contacts,
      ObjectProvider<JavaMailSender> smtp) {
    this.threads = threads;
    this.messages = messages;
    this.recipients = recipients;
    this.entries = entries;
    this.contacts = contacts;
    this.smtp = smtp;
  }

  /**
   * Delivers the message if it is still pending and due at {@code now}; returns whether it did. A
   * cancelled or already delivered message is skipped, so a repeat call is harmless.
   */
  @Transactional
  public boolean deliver(UUID messageId, Instant now) {
    Message message = messages.lockById(messageId).orElse(null);
    if (message == null
        || !PENDING.contains(message.getStatus())
        || message.getSendAt().isAfter(now)) {
      return false;
    }
    Instant sentAt = message.getSentAt();
    message.setStatus(MessageStatus.SENT);
    message.setSendAt(null);
    threads.findById(message.getThreadId()).orElseThrow().addMessage(sentAt);
    entries.findByUserIdAndThreadId(message.getFromUserId(), message.getThreadId()).stream()
        .filter(entry -> entry.getMessageId().equals(messageId))
        .forEach(entry -> entry.setMailbox(Mailbox.SENT));

    List<MessageRecipient> to = recipients.findByMessageId(messageId);
    Set<UUID> members = new LinkedHashSet<>();
    List<String> outside = new ArrayList<>();
    for (MessageRecipient recipient : to) {
      if (recipient.getUserId() == null) {
        outside.add(recipient.getEmail());
      } else if (!recipient.getUserId().equals(message.getFromUserId())) {
        members.add(recipient.getUserId());
      }
    }
    members.forEach(userId -> deliverTo(userId, message));
    collectContacts(message, to);
    if (!outside.isEmpty() && !sentOverSmtp(message, to)) {
      bounce(message, outside, now);
    }
    return true;
  }

  /** An inbox copy; a thread the recipient muted skips the inbox (FR-6.6) and keeps its tab. */
  private void deliverTo(UUID userId, Message message) {
    List<MailboxEntry> earlier = entries.findByUserIdAndThreadId(userId, message.getThreadId());
    boolean muted = earlier.stream().anyMatch(MailboxEntry::isMuted);
    Category category =
        earlier.stream()
            .map(MailboxEntry::getCategory)
            .filter(c -> c != null)
            .findFirst()
            .orElse(Category.PRIMARY);
    MailboxEntry entry =
        new MailboxEntry(
            UUID.randomUUID(),
            userId,
            message.getId(),
            message.getThreadId(),
            muted ? null : Mailbox.INBOX,
            category,
            message.getSentAt());
    entry.setMuted(muted);
    entries.save(entry);
  }

  /**
   * Auto-collected contacts: the sender gains each recipient, and each Nem Mail recipient gains the
   * sender, one exchanged message each.
   */
  private void collectContacts(Message message, List<MessageRecipient> to) {
    UUID senderId = message.getFromUserId();
    Instant at = message.getSentAt();
    Set<String> seen = new HashSet<>();
    for (MessageRecipient recipient : to) {
      String email = recipient.getEmail().toLowerCase(Locale.ROOT);
      if (!seen.add(email) || senderId.equals(recipient.getUserId())) {
        continue;
      }
      contacts.record(UUID.randomUUID(), senderId, recipient.getEmail(), recipient.getName(), at);
      if (recipient.getUserId() != null) {
        contacts.record(
            UUID.randomUUID(),
            recipient.getUserId(),
            message.getFromEmail(),
            message.getFromName(),
            at);
      }
    }
  }

  /** False when SMTP is not configured or fails, so the caller bounces instead. */
  private boolean sentOverSmtp(Message message, List<MessageRecipient> to) {
    JavaMailSender sender = smtp.getIfAvailable();
    if (sender == null) {
      return false;
    }
    Map<RecipientKind, List<String>> outside =
        to.stream()
            .filter(r -> r.getUserId() == null)
            .collect(
                Collectors.groupingBy(
                    MessageRecipient::getKind,
                    Collectors.mapping(MessageRecipient::getEmail, Collectors.toList())));
    try {
      MimeMessage mime = new ThreadedMimeMessage(messageId(message.getId()));
      MimeMessageHelper helper = new MimeMessageHelper(mime, "UTF-8");
      helper.setFrom(new InternetAddress(message.getFromEmail(), message.getFromName(), "UTF-8"));
      helper.setTo(outside.getOrDefault(RecipientKind.TO, List.of()).toArray(String[]::new));
      helper.setCc(outside.getOrDefault(RecipientKind.CC, List.of()).toArray(String[]::new));
      helper.setBcc(outside.getOrDefault(RecipientKind.BCC, List.of()).toArray(String[]::new));
      helper.setSubject(message.getSubject());
      String html = message.getBodyHtml();
      helper.setText(message.getBodyText(), html != null ? html : message.getBodyText());
      if (message.getInReplyTo() != null) {
        String parent = messageId(message.getInReplyTo());
        mime.setHeader("In-Reply-To", parent);
        mime.setHeader("References", parent);
      }
      sender.send(mime);
      return true;
    } catch (MessagingException | MailException | UnsupportedEncodingException e) {
      log.warn("SMTP delivery of message {} failed", message.getId(), e);
      return false;
    }
  }

  /** A notice in the sender's inbox, in the same thread, naming the addresses not reached. */
  private void bounce(Message message, List<String> outside, Instant deliveredAt) {
    // Always after the message it answers, so the thread reads in order.
    Instant now =
        deliveredAt.isAfter(message.getSentAt()) ? deliveredAt : message.getSentAt().plusMillis(1);
    String text =
        "Your message to "
            + String.join(", ", outside)
            + " couldn't be delivered. Nem Mail delivers mail only between Nem Mail accounts.";
    Message notice =
        new Message(
            UUID.randomUUID(),
            message.getThreadId(),
            MAILER_DAEMON,
            "Mail Delivery Subsystem",
            "Delivery Status Notification (Failure)",
            text,
            HtmlText.snippet(text),
            now,
            MessageStatus.SENT);
    notice.setInReplyTo(message.getId());
    // Inserted before its entry: batching orders inserts by entity, not by foreign key.
    messages.saveAndFlush(notice);
    threads.findById(message.getThreadId()).orElseThrow().addMessage(now);
    entries.save(
        new MailboxEntry(
            UUID.randomUUID(),
            message.getFromUserId(),
            notice.getId(),
            message.getThreadId(),
            Mailbox.INBOX,
            Category.UPDATES,
            now));
  }

  private static String messageId(UUID id) {
    return "<" + id + "@" + MESSAGE_ID_DOMAIN + ">";
  }

  /** Keeps our Message-ID, which JavaMail would otherwise replace on save, so replies thread. */
  private static final class ThreadedMimeMessage extends MimeMessage {

    private final String messageId;

    ThreadedMimeMessage(String messageId) {
      super(Session.getInstance(new Properties()));
      this.messageId = messageId;
    }

    @Override
    protected void updateMessageID() throws MessagingException {
      setHeader("Message-ID", messageId);
    }
  }
}
