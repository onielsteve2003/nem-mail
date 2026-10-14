package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Where a page of threads ends: the last row's sort key. Clients treat it as opaque, so it is
 * base64url and can change shape without breaking them.
 */
record ThreadCursor(Instant lastMessageAt, UUID threadId) {

  String encode() {
    String raw = lastMessageAt + "|" + threadId;
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  /** Null for the first page; a cursor this server did not issue is a 400. */
  static ThreadCursor decode(String cursor) {
    if (cursor == null) {
      return null;
    }
    try {
      String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      int bar = raw.indexOf('|');
      return new ThreadCursor(
          Instant.parse(raw.substring(0, bar)), UUID.fromString(raw.substring(bar + 1)));
    } catch (RuntimeException e) {
      throw new ApiException(ErrorCode.BAD_REQUEST, "The cursor is not valid.");
    }
  }
}
