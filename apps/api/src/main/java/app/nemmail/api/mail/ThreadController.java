package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ThreadController {

  private final ThreadService threads;
  private final ThreadOpsService ops;

  ThreadController(ThreadService threads, ThreadOpsService ops) {
    this.threads = threads;
    this.ops = ops;
  }

  /** {@code ?mailbox=inbox&category=social} or {@code ?label=<id>}, exactly one of the two. */
  @GetMapping("/threads")
  PageResponse<ThreadSummaryResponse> list(
      @AuthenticationPrincipal CurrentUser current,
      @RequestParam(required = false) String mailbox,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) UUID label,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
    if ((mailbox == null) == (label == null)) {
      throw Wire.invalid("mailbox", "Pass either mailbox or label.");
    }
    // As in the mock, a label list has no tabs, so category only narrows a mailbox.
    ThreadFilter filter =
        label != null
            ? new ThreadFilter.WithLabel(label)
            : new ThreadFilter.InMailbox(
                Wire.parse(MailboxView.class, mailbox, "mailbox"),
                Wire.parse(Category.class, category, "category"));
    return threads.list(current.userId(), filter, cursor, limit);
  }

  /** Another user's thread is a 404, the same as a missing one, so ids cannot be probed. */
  @GetMapping("/threads/{id}")
  ThreadResponse get(@AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    return threads.get(current.userId(), id);
  }

  /** Delete forever; only threads in Spam or Trash are deleted, others are skipped. */
  @PostMapping("/threads/delete")
  BulkThreadRequest.Response delete(
      @AuthenticationPrincipal CurrentUser current,
      @Valid @RequestBody BulkThreadRequest.Delete body) {
    return new BulkThreadRequest.Response(
        ops.deleteForever(current.userId(), body.ids(), Instant.now()));
  }

  /** Empties Spam or Trash ({@code :mailbox} is a BinMailbox). */
  @DeleteMapping("/mailboxes/{mailbox}")
  BulkThreadRequest.Response empty(
      @AuthenticationPrincipal CurrentUser current, @PathVariable String mailbox) {
    return new BulkThreadRequest.Response(
        ops.empty(current.userId(), Wire.parse(Mailbox.class, mailbox, "mailbox"), Instant.now()));
  }

  /** Bulk actions: each op maps to its own transactional service method. */
  @PatchMapping("/threads")
  BulkThreadRequest.Response bulk(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody BulkThreadRequest body) {
    UUID userId = current.userId();
    List<UUID> ids = body.ids();
    List<UUID> updated =
        switch (body.op()) {
          case ThreadOp.MarkRead _ -> ops.markRead(userId, ids);
          case ThreadOp.MarkUnread _ -> ops.markUnread(userId, ids);
          case ThreadOp.Star _ -> ops.setStarred(userId, ids, true);
          case ThreadOp.Unstar _ -> ops.setStarred(userId, ids, false);
          case ThreadOp.MarkImportant _ -> ops.setImportant(userId, ids, true);
          case ThreadOp.MarkNotImportant _ -> ops.setImportant(userId, ids, false);
          case ThreadOp.Archive _ -> ops.archive(userId, ids);
          case ThreadOp.Trash _ -> ops.move(userId, ids, Mailbox.TRASH);
          case ThreadOp.Spam _ -> ops.move(userId, ids, Mailbox.SPAM);
          case ThreadOp.NotSpam _ -> ops.move(userId, ids, Mailbox.INBOX);
          case ThreadOp.Move move ->
              ops.move(userId, ids, Wire.parse(Mailbox.class, move.to(), "op.to"));
          case ThreadOp.Mute _ -> ops.setMuted(userId, ids, true);
          case ThreadOp.Unmute _ -> ops.setMuted(userId, ids, false);
          case ThreadOp.SetCategory set ->
              ops.setCategory(
                  userId, ids, Wire.parse(Category.class, set.category(), "op.category"));
          case ThreadOp.AddLabels add -> ops.addLabels(userId, ids, add.labelIds());
          case ThreadOp.RemoveLabels remove -> ops.removeLabels(userId, ids, remove.labelIds());
          case ThreadOp.Snooze snooze -> ops.snooze(userId, ids, snooze.until());
          case ThreadOp.Unsnooze _ -> ops.unsnooze(userId, ids);
        };
    return new BulkThreadRequest.Response(updated);
  }
}
