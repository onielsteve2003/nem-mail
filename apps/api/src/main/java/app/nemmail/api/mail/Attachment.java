package app.nemmail.api.mail;

import app.nemmail.api.common.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * A file on a message. {@code messageId} is null while it only belongs to a draft, and {@code data}
 * is null for seeded files, which have a name and size but no content.
 */
@Entity
@Table(name = "attachments")
public class Attachment extends BaseEntity {

  private UUID messageId;
  private String filename;
  private String mime;
  private int size;
  private byte[] data;

  protected Attachment() {}

  public Attachment(UUID id, UUID messageId, String filename, String mime, int size) {
    super(id);
    this.messageId = messageId;
    this.filename = filename;
    this.mime = mime;
    this.size = size;
  }

  public UUID getMessageId() {
    return messageId;
  }

  public void setMessageId(UUID messageId) {
    this.messageId = messageId;
  }

  public String getFilename() {
    return filename;
  }

  public String getMime() {
    return mime;
  }

  public int getSize() {
    return size;
  }

  public byte[] getData() {
    return data == null ? null : data.clone();
  }

  public void setData(byte[] data) {
    this.data = data == null ? null : data.clone();
  }
}
