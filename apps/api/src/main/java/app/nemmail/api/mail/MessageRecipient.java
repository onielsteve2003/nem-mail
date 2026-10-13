package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/** A To, Cc or Bcc address of a message; {@code userId} is set when it is an app user. */
@Entity
@Table(name = "message_recipients")
public class MessageRecipient extends BaseEntity {

  private UUID messageId;
  private String email;
  private String name;
  private UUID userId;

  @Convert(converter = RecipientKind.Converter.class)
  private RecipientKind kind;

  protected MessageRecipient() {}

  public MessageRecipient(
      UUID id, UUID messageId, String email, String name, UUID userId, RecipientKind kind) {
    super(id);
    this.messageId = messageId;
    this.email = email;
    this.name = name;
    this.userId = userId;
    this.kind = kind;
  }

  public UUID getMessageId() {
    return messageId;
  }

  public String getEmail() {
    return email;
  }

  public String getName() {
    return name;
  }

  public UUID getUserId() {
    return userId;
  }

  public RecipientKind getKind() {
    return kind;
  }
}
