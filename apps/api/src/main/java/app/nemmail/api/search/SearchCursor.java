package app.nemmail.api.search;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Where a page of ranked hits ends: rank, then date and id. Opaque to clients, like ThreadCursor.
 */
record SearchCursor(float rank, Instant lastMessageAt, UUID threadId) {

  String encode() {
    String raw = rank + "|" + lastMessageAt + "|" + threadId;
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  /** Null for the first page; a cursor this server did not issue is a 400. */
  static SearchCursor decode(String cursor) {
    if (cursor == null) {
      return null;
    }
    try {
      String[] parts =
          new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|");
      return new SearchCursor(
          Float.parseFloat(parts[0]), Instant.parse(parts[1]), UUID.fromString(parts[2]));
    } catch (RuntimeException e) {
      throw new ApiException(ErrorCode.BAD_REQUEST, "The cursor is not valid.");
    }
  }
}
