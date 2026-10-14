package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** A user's drafts, kept as DraftSchema JSON. PUT is the autosave: it creates or replaces. */
@Service
public class DraftService {

  private final DraftRepository drafts;
  private final MailboxEntryRepository entries;
  private final JsonMapper json;

  DraftService(DraftRepository drafts, MailboxEntryRepository entries, JsonMapper json) {
    this.drafts = drafts;
    this.entries = entries;
    this.json = json;
  }

  /** Most recently edited first. */
  @Transactional(readOnly = true)
  public List<DraftBody> list(UUID userId) {
    return drafts.findByUserIdOrderByUpdatedAtDesc(userId).stream().map(this::body).toList();
  }

  @Transactional(readOnly = true)
  public DraftBody get(UUID userId, UUID draftId) {
    return body(own(userId, draftId));
  }

  /**
   * Saves the draft under {@code draftId} with the server's time as {@code updatedAt}. The thread
   * it replies to must be one of the user's; another user's draft id is a 403, as in the mock.
   */
  @Transactional
  public DraftBody save(UUID userId, UUID draftId, DraftBody body) {
    if (!draftId.toString().equals(body.id())) {
      throw Wire.invalid("id", "The id must match the URL.");
    }
    body.checkMode();
    UUID threadId = ownThread(userId, body.threadId());
    Instant now = Instant.now();
    DraftBody saved = body.withUpdatedAt(now);
    String payload = json.writeValueAsString(saved);
    drafts
        .findById(draftId)
        .ifPresentOrElse(
            draft -> {
              if (!draft.getUserId().equals(userId)) {
                throw new ApiException(ErrorCode.FORBIDDEN, "Not your draft.");
              }
              draft.setPayload(payload, threadId, now);
            },
            () -> drafts.save(new Draft(draftId, userId, threadId, payload, now)));
    return saved;
  }

  @Transactional
  public void delete(UUID userId, UUID draftId) {
    drafts.delete(own(userId, draftId));
  }

  /** Removes a draft that was just sent; an unknown or foreign id is ignored. */
  @Transactional
  public void discard(UUID userId, String draftId) {
    try {
      drafts
          .findById(UUID.fromString(draftId))
          .filter(draft -> draft.getUserId().equals(userId))
          .ifPresent(drafts::delete);
    } catch (IllegalArgumentException e) {
      // Not a UUID, so never saved here.
    }
  }

  private Draft own(UUID userId, UUID draftId) {
    return drafts
        .findById(draftId)
        .filter(draft -> draft.getUserId().equals(userId))
        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Draft not found."));
  }

  /** The id of one of the user's threads, or null; anything else is a 422. */
  UUID ownThread(UUID userId, String raw) {
    if (raw == null) {
      return null;
    }
    UUID threadId;
    try {
      threadId = UUID.fromString(raw);
    } catch (IllegalArgumentException e) {
      throw Wire.invalid("threadId", "This conversation was not found.");
    }
    if (entries.findByUserIdAndThreadId(userId, threadId).isEmpty()) {
      throw Wire.invalid("threadId", "This conversation was not found.");
    }
    return threadId;
  }

  private DraftBody body(Draft draft) {
    return json.readValue(draft.getPayload(), DraftBody.class);
  }
}
