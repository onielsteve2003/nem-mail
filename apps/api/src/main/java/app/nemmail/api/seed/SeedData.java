package app.nemmail.api.seed;

import java.time.Instant;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * The shape of {@code packages/shared/fixtures/seed.json} (SeedData in @nem/shared). Only the
 * fields the database stores are listed; Jackson ignores the rest.
 */
public record SeedData(String seed, Instant generatedAt, List<Account> accounts) {

  public record Account(
      User user,
      List<Label> labels,
      List<Contact> contacts,
      List<Thread> threads,
      List<JsonNode> drafts,
      JsonNode settings) {}

  public record User(String id, String email, String name, String avatarSeed, Instant createdAt) {}

  public record Label(String id, String name, String color, String parentId) {}

  public record Contact(
      String id, String email, String name, Instant lastContactedAt, int frequency) {}

  public record Thread(
      String id,
      String subject,
      Instant lastMessageAt,
      List<String> mailboxes,
      String category,
      List<String> labelIds,
      boolean isStarred,
      boolean isImportant,
      boolean isMuted,
      Instant snoozedUntil,
      List<Message> messages) {}

  public record Message(
      String id,
      Address from,
      List<Address> to,
      List<Address> cc,
      List<Address> bcc,
      String subject,
      String bodyHtml,
      String bodyText,
      String snippet,
      Instant sentAt,
      Instant sendAt,
      String status,
      String inReplyTo,
      List<Attachment> attachments,
      boolean isRead,
      JsonNode ai) {}

  public record Address(String email, String name) {}

  public record Attachment(String id, String filename, String mime, int size) {}
}
