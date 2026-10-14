package app.nemmail.api.mail;

import java.util.List;

/** One SSE message (ServerEventSchema in @nem/shared), sent as JSON in the {@code data} field. */
sealed interface ServerEvent {

  record MailNew(String type, ThreadSummaryResponse summary) implements ServerEvent {
    MailNew(ThreadSummaryResponse summary) {
      this("mail.new", summary);
    }
  }

  record Counts(String type, CountsService.Response counts) implements ServerEvent {
    Counts(CountsService.Response counts) {
      this("counts", counts);
    }
  }

  /** Snoozed threads whose time came: back in the inbox, unread (FR-6.3). */
  record SnoozeWoke(String type, List<ThreadSummaryResponse> summaries) implements ServerEvent {
    SnoozeWoke(List<ThreadSummaryResponse> summaries) {
      this("snooze.woke", summaries);
    }
  }
}
