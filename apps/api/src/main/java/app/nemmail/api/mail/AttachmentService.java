package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import app.nemmail.api.mail.ThreadResponse.AttachmentResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.InvalidMimeTypeException;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Files in Postgres {@code bytea} (ADR-8). An upload belongs to its uploader until a send links it
 * to the message; from then on everyone with a copy of the message can read it too.
 */
@Service
public class AttachmentService {

  /** MAX_ATTACHMENT_BYTES in @nem/shared (FR-5.4). */
  public static final int MAX_BYTES = 10 * 1024 * 1024;

  private static final String DEFAULT_MIME = "application/octet-stream";

  /** Leading bytes of the types browsers render inline, so a file cannot pass as one of them. */
  private static final Map<String, List<byte[]>> SIGNATURES =
      Map.of(
          "image/png", List.of(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)),
          "image/jpeg", List.of(bytes(0xFF, 0xD8, 0xFF)),
          "image/gif",
              List.of(bytes('G', 'I', 'F', '8', '7', 'a'), bytes('G', 'I', 'F', '8', '9', 'a')),
          "image/webp", List.of(bytes('R', 'I', 'F', 'F')),
          "application/pdf", List.of(bytes('%', 'P', 'D', 'F', '-')));

  /** A file and its bytes, for the download response. */
  public record Download(String filename, String mime, byte[] data) {}

  private final AttachmentRepository attachments;

  AttachmentService(AttachmentRepository attachments) {
    this.attachments = attachments;
  }

  /** Stores an upload. 413 over 10 MB; 422 for a bad type or bytes that do not match it. */
  @Transactional
  public AttachmentResponse upload(UUID userId, MultipartFile file) {
    if (file.getSize() > MAX_BYTES) {
      throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, "Attachments can be up to 10 MB.");
    }
    byte[] data;
    try {
      data = file.getBytes();
    } catch (IOException e) {
      throw new ApiException(ErrorCode.BAD_REQUEST, "The file could not be read.");
    }
    String mime = mime(file.getContentType());
    List<byte[]> signatures = SIGNATURES.get(mime);
    if (signatures != null && signatures.stream().noneMatch(s -> startsWith(data, s))) {
      throw Wire.invalid("file", "The file's content does not match its type (" + mime + ").");
    }
    Attachment attachment =
        new Attachment(
            UUID.randomUUID(), null, filename(file.getOriginalFilename()), mime, data.length);
    attachment.setUserId(userId);
    attachment.setData(data);
    attachments.save(attachment);
    return response(attachment);
  }

  /** 404 when the user may not read the file or it has no content (seeded files). */
  @Transactional(readOnly = true)
  public Download download(UUID userId, UUID id) {
    Attachment attachment =
        attachments
            .findReadable(userId, id)
            .filter(a -> a.getData() != null)
            .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "File not found."));
    return new Download(attachment.getFilename(), attachment.getMime(), attachment.getData());
  }

  /**
   * Puts the draft's files on the sent message: the user's own uploads move onto it, and files of
   * mail they can read (a forward) are copied. Ids the user cannot read are skipped.
   */
  void attach(UUID userId, UUID messageId, List<DraftBody.Attachment> files) {
    for (DraftBody.Attachment file : files) {
      UUID id;
      try {
        id = UUID.fromString(file.id());
      } catch (IllegalArgumentException e) {
        continue;
      }
      attachments
          .findReadable(userId, id)
          .ifPresent(
              found -> {
                if (found.getMessageId() == null && userId.equals(found.getUserId())) {
                  found.setMessageId(messageId);
                  return;
                }
                Attachment copy =
                    new Attachment(
                        UUID.randomUUID(),
                        messageId,
                        found.getFilename(),
                        found.getMime(),
                        found.getSize());
                copy.setUserId(userId);
                copy.setData(found.getData());
                attachments.save(copy);
              });
    }
  }

  /** Undo send: the message's files go back to being the sender's uploads, for the new draft. */
  List<DraftBody.Attachment> detach(UUID userId, UUID messageId) {
    List<DraftBody.Attachment> out = new ArrayList<>();
    for (Attachment attachment : attachments.findByMessageId(messageId)) {
      attachment.setMessageId(null);
      attachment.setUserId(userId);
      out.add(
          new DraftBody.Attachment(
              attachment.getId().toString(),
              attachment.getFilename(),
              attachment.getMime(),
              attachment.getSize()));
    }
    attachments.flush();
    return out;
  }

  private static AttachmentResponse response(Attachment a) {
    return new AttachmentResponse(a.getId(), a.getFilename(), a.getMime(), a.getSize());
  }

  /** {@code type/subtype} in lowercase without parameters; none given is octet-stream. */
  private static String mime(String declared) {
    if (declared == null || declared.isBlank()) {
      return DEFAULT_MIME;
    }
    try {
      MimeType type = MimeTypeUtils.parseMimeType(declared);
      if (type.isWildcardType() || type.isWildcardSubtype()) {
        throw Wire.invalid("file", "The file type is not valid.");
      }
      return (type.getType() + "/" + type.getSubtype()).toLowerCase(Locale.ROOT);
    } catch (InvalidMimeTypeException e) {
      throw Wire.invalid("file", "The file type is not valid.");
    }
  }

  /** The base name without control characters, at most 255 long; "attachment" when empty. */
  private static String filename(String original) {
    String name = original == null ? "" : original;
    name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
    name = name.replaceAll("\\p{Cntrl}", "").strip();
    if (name.length() > 255) {
      name = name.substring(0, 255);
    }
    return name.isEmpty() ? "attachment" : name;
  }

  private static boolean startsWith(byte[] data, byte[] prefix) {
    return data.length >= prefix.length
        && Arrays.equals(data, 0, prefix.length, prefix, 0, prefix.length);
  }

  private static byte[] bytes(int... values) {
    byte[] out = new byte[values.length];
    for (int i = 0; i < values.length; i++) {
      out[i] = (byte) values[i];
    }
    return out;
  }
}
