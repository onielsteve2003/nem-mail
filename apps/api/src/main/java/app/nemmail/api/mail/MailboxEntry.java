package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

/** One user's copy of a message: its folder, tab, flags and labels. */
@Entity
@Table(name = "mailbox_entries")
public class MailboxEntry extends BaseEntity {

  private UUID userId;
  private UUID messageId;
  private UUID threadId;

  /** Null when archived. */
  @Convert(converter = Mailbox.Converter.class)
  private Mailbox mailbox;

  @Convert(converter = Category.Converter.class)
  private Category category;

  private Instant lastMessageAt;
  private boolean isRead;
  private boolean isStarred;
  private boolean isImportant;
  private boolean isMuted;
  private Instant snoozedUntil;
  private Instant deletedAt;

  // Lists load many entries at once; fetch their labels in batches, not one query each.
  @BatchSize(size = 100)
  @ElementCollection
  @CollectionTable(name = "entry_labels", joinColumns = @JoinColumn(name = "entry_id"))
  @Column(name = "label_id")
  private Set<UUID> labelIds = new HashSet<>();

  protected MailboxEntry() {}

  public MailboxEntry(
      UUID id,
      UUID userId,
      UUID messageId,
      UUID threadId,
      Mailbox mailbox,
      Category category,
      Instant lastMessageAt) {
    super(id);
    this.userId = userId;
    this.messageId = messageId;
    this.threadId = threadId;
    this.mailbox = mailbox;
    this.category = category;
    this.lastMessageAt = lastMessageAt;
  }

  public UUID getUserId() {
    return userId;
  }

  public UUID getMessageId() {
    return messageId;
  }

  public UUID getThreadId() {
    return threadId;
  }

  public Mailbox getMailbox() {
    return mailbox;
  }

  public void setMailbox(Mailbox mailbox) {
    this.mailbox = mailbox;
  }

  public Category getCategory() {
    return category;
  }

  public void setCategory(Category category) {
    this.category = category;
  }

  public Instant getLastMessageAt() {
    return lastMessageAt;
  }

  public void setLastMessageAt(Instant lastMessageAt) {
    this.lastMessageAt = lastMessageAt;
  }

  public boolean isRead() {
    return isRead;
  }

  public void setRead(boolean read) {
    isRead = read;
  }

  public boolean isStarred() {
    return isStarred;
  }

  public void setStarred(boolean starred) {
    isStarred = starred;
  }

  public boolean isImportant() {
    return isImportant;
  }

  public void setImportant(boolean important) {
    isImportant = important;
  }

  public boolean isMuted() {
    return isMuted;
  }

  public void setMuted(boolean muted) {
    isMuted = muted;
  }

  public Instant getSnoozedUntil() {
    return snoozedUntil;
  }

  public void setSnoozedUntil(Instant snoozedUntil) {
    this.snoozedUntil = snoozedUntil;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant deletedAt) {
    this.deletedAt = deletedAt;
  }

  public Set<UUID> getLabelIds() {
    return labelIds;
  }
}
