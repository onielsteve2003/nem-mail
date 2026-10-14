package app.nemmail.api.mail;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One row of the mail list (ThreadSummarySchema in @nem/shared), folded from the user's entries in
 * the thread. AI insights are filled on ingest (T18), so {@code ai} is left out for now.
 */
public record ThreadSummaryResponse(
    UUID id,
    String subject,
    String snippet,
    List<Address> participants,
    List<Address> recipients,
    int messageCount,
    Instant lastMessageAt,
    List<String> mailboxes,
    String category,
    List<UUID> labelIds,
    boolean isUnread,
    boolean isStarred,
    boolean isImportant,
    boolean isMuted,
    Instant snoozedUntil,
    List<AttachmentPreview> attachments) {

  /** The same row with another snippet, such as a search excerpt. */
  public ThreadSummaryResponse withSnippet(String text) {
    return new ThreadSummaryResponse(
        id,
        subject,
        text,
        participants,
        recipients,
        messageCount,
        lastMessageAt,
        mailboxes,
        category,
        labelIds,
        isUnread,
        isStarred,
        isImportant,
        isMuted,
        snoozedUntil,
        attachments);
  }

  /** A header address; the name is left out when unknown, as AddressSchema expects. */
  public record Address(String email, @JsonInclude(JsonInclude.Include.NON_NULL) String name) {}

  public record AttachmentPreview(String filename, String mime) {}
}
