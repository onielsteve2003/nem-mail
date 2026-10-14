package app.nemmail.api.mail;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * DraftSchema in @nem/shared, the body of {@code PUT /drafts/:id} and the JSON kept in {@code
 * drafts.payload}. Ids stay strings as in the contract; the service checks the ones it uses.
 */
public record DraftBody(
    @NotBlank String id,
    @NotNull String mode,
    String threadId,
    String inReplyTo,
    @NotNull @Size(max = 100) List<@NotNull @Valid Address> to,
    @NotNull @Size(max = 100) List<@NotNull @Valid Address> cc,
    @NotNull @Size(max = 100) List<@NotNull @Valid Address> bcc,
    @NotNull @Size(max = 1000) String subject,
    @NotNull @Size(max = 500_000) String bodyHtml,
    @NotNull @Size(max = 25) List<@NotNull @Valid Attachment> attachments,
    Instant scheduledAt,
    Instant updatedAt) {

  /** ComposeModeSchema. */
  static final List<String> MODES = List.of("new", "reply", "replyAll", "forward");

  /** AddressSchema. A missing name is left out, since the schema has it optional, not nullable. */
  public record Address(
      @NotBlank @Email String email,
      @JsonInclude(JsonInclude.Include.NON_NULL) @Size(max = 200) String name) {}

  /** AttachmentSchema; 10 MB is MAX_ATTACHMENT_BYTES. */
  public record Attachment(
      @NotBlank String id,
      @NotBlank @Size(max = 255) String filename,
      @NotBlank String mime,
      @PositiveOrZero @Max(10_485_760) long size) {}

  /** A 422 unless {@code mode} is a ComposeModeSchema value. */
  void checkMode() {
    if (!MODES.contains(mode)) {
      throw Wire.invalid("mode", "Unknown value \"" + mode + "\".");
    }
  }

  DraftBody withUpdatedAt(Instant at) {
    return new DraftBody(
        id,
        mode,
        threadId,
        inReplyTo,
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        attachments,
        scheduledAt,
        at);
  }
}
