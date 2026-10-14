package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.mail.ThreadResponse.AttachmentResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
class AttachmentController {

  private final AttachmentService attachments;

  AttachmentController(AttachmentService attachments) {
    this.attachments = attachments;
  }

  /** Multipart with one {@code file} part; answers AttachmentSchema. */
  @PostMapping(path = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  AttachmentResponse upload(
      @AuthenticationPrincipal CurrentUser current, @RequestPart("file") MultipartFile file) {
    return attachments.upload(current.userId(), file);
  }

  /**
   * The bytes, always as a download: with nosniff and the API's {@code default-src 'none'} CSP, an
   * uploaded HTML or SVG file never runs as a page. Another user's file is a 404.
   */
  @GetMapping("/attachments/{id}")
  ResponseEntity<byte[]> download(
      @AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    AttachmentService.Download file = attachments.download(current.userId(), id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(file.mime()))
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment()
                .filename(file.filename(), StandardCharsets.UTF_8)
                .build()
                .toString())
        .cacheControl(CacheControl.noStore().cachePrivate())
        .body(file.data());
  }
}
