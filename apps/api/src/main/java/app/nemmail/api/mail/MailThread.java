package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A conversation. Named so it does not clash with {@link java.lang.Thread}. */
@Entity
@Table(name = "threads")
public class MailThread extends BaseEntity {

  private String subject;
  private Instant lastMessageAt;
  private int messageCount;

  protected MailThread() {}

  public MailThread(UUID id, String subject, Instant lastMessageAt) {
    super(id);
    this.subject = subject;
    this.lastMessageAt = lastMessageAt;
  }

  public String getSubject() {
    return subject;
  }

  public Instant getLastMessageAt() {
    return lastMessageAt;
  }

  public int getMessageCount() {
    return messageCount;
  }

  /** Counts a message added to the thread at {@code sentAt}. */
  public void addMessage(Instant sentAt) {
    messageCount++;
    if (sentAt.isAfter(lastMessageAt)) {
      lastMessageAt = sentAt;
    }
  }
}
