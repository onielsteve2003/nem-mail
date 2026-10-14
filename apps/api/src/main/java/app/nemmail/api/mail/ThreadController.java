package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.PageResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ThreadController {

  private final ThreadService threads;

  ThreadController(ThreadService threads) {
    this.threads = threads;
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
}
