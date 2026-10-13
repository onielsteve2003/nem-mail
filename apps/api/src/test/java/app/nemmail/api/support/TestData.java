package app.nemmail.api.support;

import app.nemmail.api.auth.User;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.Label;
import app.nemmail.api.mail.LabelColor;
import app.nemmail.api.mail.LabelRepository;
import app.nemmail.api.mail.MailThread;
import app.nemmail.api.mail.MailThreadRepository;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.mail.Message;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.mail.MessageStatus;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.test.context.TestComponent;

/**
 * Factories for the rows a test needs. Emails are unique per call, so tests sharing one context and
 * database never collide; a test that needs a clean slate is {@code @Transactional}.
 */
@TestComponent
public class TestData {

  private static final AtomicInteger SEQUENCE = new AtomicInteger();

  private final UserRepository users;
  private final MailThreadRepository threads;
  private final MessageRepository messages;
  private final MailboxEntryRepository entries;
  private final LabelRepository labels;

  TestData(
      UserRepository users,
      MailThreadRepository threads,
      MessageRepository messages,
      MailboxEntryRepository entries,
      LabelRepository labels) {
    this.users = users;
    this.threads = threads;
    this.messages = messages;
    this.entries = entries;
    this.labels = labels;
  }

  /** A unique address such as {@code ada-7@nemmail.example}. */
  public static String email(String name) {
    return name.toLowerCase() + "-" + SEQUENCE.incrementAndGet() + "@nemmail.example";
  }

  /** A user who cannot sign in (the hash matches no password). */
  public User user(String name) {
    return user(name, email(name), "!");
  }

  public User user(String name, String email, String passwordHash) {
    return users.saveAndFlush(
        new User(UUID.randomUUID(), email, name, passwordHash, name.toLowerCase()));
  }

  /** A one-message thread from {@code fromEmail}, delivered to the owner's inbox. */
  public MailboxEntry received(User owner, String fromEmail, String subject, Instant at) {
    MailThread thread = threads.save(new MailThread(UUID.randomUUID(), subject, at));
    String body = "About " + subject + ".";
    Message message =
        messages.save(
            new Message(
                UUID.randomUUID(),
                thread.getId(),
                fromEmail,
                null,
                subject,
                body,
                body,
                at,
                MessageStatus.SENT));
    return entries.saveAndFlush(
        new MailboxEntry(
            UUID.randomUUID(),
            owner.getId(),
            message.getId(),
            thread.getId(),
            Mailbox.INBOX,
            Category.PRIMARY,
            at));
  }

  public Label label(User owner, String name, LabelColor color) {
    return labels.saveAndFlush(new Label(UUID.randomUUID(), owner.getId(), name, color, null));
  }
}
