package app.nemmail.api.mail;

import app.nemmail.api.mail.ThreadSummaryResponse.Address;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A thread with its messages (ThreadSchema in @nem/shared): the summary fields plus messages. */
public record ThreadResponse(
    @JsonUnwrapped ThreadSummaryResponse summary, List<MessageResponse> messages) {

  /** MessageSchema. {@code bcc} is empty unless the user sent the message. */
  public record MessageResponse(
      UUID id,
      UUID threadId,
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
      UUID inReplyTo,
      List<AttachmentResponse> attachments,
      boolean isRead,
      // Stored as AIInsights JSON already; written through as-is, or left out when absent.
      @JsonInclude(JsonInclude.Include.NON_NULL) @JsonRawValue String ai) {}

  /** AttachmentSchema: metadata only; the bytes come from GET /attachments/{id} (T17.2). */
  public record AttachmentResponse(UUID id, String filename, String mime, int size) {}
}
