package app.nemmail.api.seed;

import app.nemmail.api.auth.User;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.config.ApiProperties;
import app.nemmail.api.mail.Attachment;
import app.nemmail.api.mail.AttachmentRepository;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.Contact;
import app.nemmail.api.mail.ContactRepository;
import app.nemmail.api.mail.Draft;
import app.nemmail.api.mail.DraftRepository;
import app.nemmail.api.mail.Label;
import app.nemmail.api.mail.LabelColor;
import app.nemmail.api.mail.LabelRepository;
import app.nemmail.api.mail.MailThread;
import app.nemmail.api.mail.MailThreadRepository;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.mail.Message;
import app.nemmail.api.mail.MessageRecipient;
import app.nemmail.api.mail.MessageRecipientRepository;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.mail.MessageStatus;
import app.nemmail.api.mail.RecipientKind;
import app.nemmail.api.settings.UserSettings;
import app.nemmail.api.settings.UserSettingsRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Writes the shared demo seed into the database. Seed ids become stable name-based UUIDs, and every
 * timestamp moves forward by {@code now - generatedAt}, so the demo always looks fresh.
 */
@Service
public class SeedLoader {

  private static final Set<String> OWN_MAILBOXES = Set.of("sent", "scheduled", "outbox", "drafts");

  private final UserRepository users;
  private final LabelRepository labels;
  private final ContactRepository contacts;
  private final MailThreadRepository threads;
  private final MessageRepository messages;
  private final MessageRecipientRepository recipients;
  private final MailboxEntryRepository entries;
  private final AttachmentRepository attachments;
  private final DraftRepository drafts;
  private final UserSettingsRepository settings;
  private final PasswordEncoder passwords;
  private final String demoPassword;

  public SeedLoader(
      UserRepository users,
      LabelRepository labels,
      ContactRepository contacts,
      MailThreadRepository threads,
      MessageRepository messages,
      MessageRecipientRepository recipients,
      MailboxEntryRepository entries,
      AttachmentRepository attachments,
      DraftRepository drafts,
      UserSettingsRepository settings,
      PasswordEncoder passwords,
      ApiProperties properties) {
    this.users = users;
    this.labels = labels;
    this.contacts = contacts;
    this.threads = threads;
    this.messages = messages;
    this.recipients = recipients;
    this.entries = entries;
    this.attachments = attachments;
    this.drafts = drafts;
    this.settings = settings;
    this.passwords = passwords;
    this.demoPassword = properties.demo().password();
  }

  /** The database id for a seed id such as {@code u1-t12m2}. */
  public static UUID idOf(String seedId) {
    return seedId == null
        ? null
        : UUID.nameUUIDFromBytes(("nem-seed:" + seedId).getBytes(StandardCharsets.UTF_8));
  }

  /** Writes every seed account; each one signs in with the demo password. */
  @Transactional
  public void load(SeedData data, Instant now) {
    String passwordHash = passwords.encode(demoPassword);
    Duration shift = Duration.between(data.generatedAt(), now);
    Map<String, UUID> userIdsByEmail =
        data.accounts().stream()
            .collect(
                Collectors.toMap(
                    account -> account.user().email().toLowerCase(Locale.ROOT),
                    account -> idOf(account.user().id())));
    for (SeedData.Account account : data.accounts()) {
      new AccountWriter(account, shift, userIdsByEmail, passwordHash).write();
    }
  }

  private final class AccountWriter {

    private final SeedData.Account account;
    private final Duration shift;
    private final Map<String, UUID> userIdsByEmail;
    private final UUID userId;
    private final String email;
    private final String passwordHash;

    AccountWriter(
        SeedData.Account account,
        Duration shift,
        Map<String, UUID> userIdsByEmail,
        String passwordHash) {
      this.account = account;
      this.shift = shift;
      this.userIdsByEmail = userIdsByEmail;
      this.userId = idOf(account.user().id());
      this.email = account.user().email();
      this.passwordHash = passwordHash;
    }

    void write() {
      SeedData.User seedUser = account.user();
      User user = new User(userId, email, seedUser.name(), passwordHash, seedUser.avatarSeed());
      user.setCreatedAt(shifted(seedUser.createdAt()));
      users.save(user);
      settings.save(new UserSettings(userId, account.settings().toString()));
      // Parents come first in the seed, so their rows exist before the children's.
      labels.saveAll(
          account.labels().stream()
              .map(
                  label ->
                      new Label(
                          idOf(label.id()),
                          userId,
                          label.name(),
                          parse(LabelColor.class, label.color()),
                          idOf(label.parentId())))
              .toList());
      contacts.saveAll(account.contacts().stream().map(this::contact).toList());
      account.threads().forEach(this::thread);
      drafts.saveAll(account.drafts().stream().map(this::draft).toList());
    }

    private Contact contact(SeedData.Contact seed) {
      Contact contact = new Contact(idOf(seed.id()), userId, seed.email(), seed.name());
      contact.setHistory(seed.frequency(), shifted(seed.lastContactedAt()));
      return contact;
    }

    private void thread(SeedData.Thread seed) {
      MailThread thread =
          new MailThread(idOf(seed.id()), seed.subject(), shifted(seed.lastMessageAt()));
      // Trash, spam or inbox for mail from others; none means archived.
      String filed =
          seed.mailboxes().stream()
              .filter(box -> !OWN_MAILBOXES.contains(box))
              .findFirst()
              .orElse(null);
      boolean trashed = seed.mailboxes().contains("trash");
      Category category = parse(Category.class, seed.category());
      List<Message> threadMessages = new ArrayList<>();
      List<MessageRecipient> threadRecipients = new ArrayList<>();
      List<Attachment> threadAttachments = new ArrayList<>();
      List<MailboxEntry> threadEntries = new ArrayList<>();
      for (SeedData.Message seedMessage : seed.messages()) {
        Message message = message(thread.getId(), seedMessage);
        thread.addMessage(message.getSentAt());
        threadMessages.add(message);
        addRecipients(threadRecipients, message.getId(), seedMessage);
        for (SeedData.Attachment file : seedMessage.attachments()) {
          threadAttachments.add(
              new Attachment(
                  idOf(seedMessage.id() + ":" + file.id()),
                  message.getId(),
                  file.filename(),
                  file.mime(),
                  file.size()));
        }
        boolean mine = seedMessage.from().email().equalsIgnoreCase(email);
        Mailbox mailbox =
            parse(
                Mailbox.class, trashed ? "trash" : mine ? ownMailbox(message.getStatus()) : filed);
        MailboxEntry entry =
            new MailboxEntry(
                idOf(userId + ":" + seedMessage.id()),
                userId,
                message.getId(),
                thread.getId(),
                mailbox,
                category,
                thread.getLastMessageAt());
        entry.setRead(seedMessage.isRead());
        entry.setStarred(seed.isStarred());
        entry.setImportant(seed.isImportant());
        entry.setMuted(seed.isMuted());
        entry.setSnoozedUntil(shifted(seed.snoozedUntil()));
        seed.labelIds().forEach(labelId -> entry.getLabelIds().add(idOf(labelId)));
        threadEntries.add(entry);
      }
      threadEntries.forEach(entry -> entry.setLastMessageAt(thread.getLastMessageAt()));
      threads.save(thread);
      messages.saveAll(threadMessages);
      recipients.saveAll(threadRecipients);
      attachments.saveAll(threadAttachments);
      entries.saveAll(threadEntries);
    }

    private Message message(UUID threadId, SeedData.Message seed) {
      Message message =
          new Message(
              idOf(seed.id()),
              threadId,
              seed.from().email(),
              seed.from().name(),
              seed.subject(),
              seed.bodyText(),
              seed.snippet(),
              shifted(seed.sentAt()),
              parse(MessageStatus.class, seed.status()));
      message.setFromUserId(appUser(seed.from().email()));
      message.setBodyHtml(seed.bodyHtml());
      message.setSendAt(shifted(seed.sendAt()));
      message.setInReplyTo(idOf(seed.inReplyTo()));
      message.setAi(seed.ai() == null ? null : seed.ai().toString());
      return message;
    }

    private void addRecipients(List<MessageRecipient> out, UUID messageId, SeedData.Message seed) {
      for (RecipientKind kind : RecipientKind.values()) {
        List<SeedData.Address> addresses =
            switch (kind) {
              case TO -> seed.to();
              case CC -> seed.cc();
              case BCC -> seed.bcc();
            };
        for (int i = 0; i < addresses.size(); i++) {
          SeedData.Address address = addresses.get(i);
          out.add(
              new MessageRecipient(
                  idOf(messageId + ":" + kind + ":" + i),
                  messageId,
                  address.email(),
                  address.name(),
                  appUser(address.email()),
                  kind));
        }
      }
    }

    private Draft draft(JsonNode seed) {
      ObjectNode payload = (ObjectNode) seed.deepCopy();
      UUID id = idOf(seed.get("id").asString());
      UUID threadId = idOf(text(seed, "threadId"));
      Instant updatedAt = shifted(Instant.parse(seed.get("updatedAt").asString()));
      payload.put("id", id.toString());
      payload.put("threadId", threadId == null ? null : threadId.toString());
      UUID inReplyTo = idOf(text(seed, "inReplyTo"));
      payload.put("inReplyTo", inReplyTo == null ? null : inReplyTo.toString());
      payload.put("updatedAt", updatedAt.toString());
      String scheduledAt = text(seed, "scheduledAt");
      payload.put(
          "scheduledAt",
          scheduledAt == null ? null : shifted(Instant.parse(scheduledAt)).toString());
      return new Draft(id, userId, threadId, payload.toString(), updatedAt);
    }

    private UUID appUser(String address) {
      return userIdsByEmail.get(address.toLowerCase(Locale.ROOT));
    }

    private Instant shifted(Instant at) {
      return at == null ? null : at.plus(shift);
    }
  }

  private static String ownMailbox(MessageStatus status) {
    return switch (status) {
      case SENT -> "sent";
      case SCHEDULED -> "scheduled";
      case OUTBOX -> "outbox";
      case DRAFT -> "drafts";
    };
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : value.asString();
  }

  private static <E extends Enum<E>> E parse(Class<E> type, String value) {
    return value == null ? null : Enum.valueOf(type, value.toUpperCase(Locale.ROOT));
  }
}
