package app.nemmail.api.mail;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Pages of thread ids for a list view. A user has one entry per message, so the view rules of
 * {@code inMailbox} in @nem/shared are applied per thread, over its entries, in {@code having}.
 * Every fragment below is a constant; values are always bound as parameters.
 */
@Repository
class ThreadListRepository {

  /** Spam or Trash: such threads show only there. */
  private static final String BINNED = "count(*) filter (where e.mailbox in ('spam', 'trash')) > 0";

  private static final String SNOOZED = "count(*) filter (where e.snoozed_until > :now) > 0";
  private static final String IN_BOX = "count(*) filter (where e.mailbox = :box) > 0";

  record Row(UUID threadId, Instant lastMessageAt) {}

  private final JdbcClient jdbc;

  ThreadListRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** Up to {@code limit} threads after {@code after}, newest first, id breaking ties. */
  List<Row> page(UUID userId, ThreadFilter filter, ThreadCursor after, int limit, Instant now) {
    Map<String, Object> params = new HashMap<>();
    params.put("userId", userId);
    params.put("now", utc(now));
    params.put("limit", limit);
    StringBuilder sql =
        new StringBuilder(
            "select e.thread_id, max(e.last_message_at) as last_at from mailbox_entries e"
                + " where e.user_id = :userId and e.deleted_at is null");
    String having =
        switch (filter) {
          case ThreadFilter.WithLabel label -> {
            params.put("labelId", label.labelId());
            sql.append(
                " and e.thread_id in (select le.thread_id from mailbox_entries le"
                    + " join entry_labels l on l.entry_id = le.id"
                    + " where le.user_id = :userId and le.deleted_at is null"
                    + " and l.label_id = :labelId)");
            yield "not " + BINNED;
          }
          case ThreadFilter.InMailbox box -> {
            String view = view(box.mailbox(), params);
            if (box.category() != null) {
              params.put("category", Wire.name(box.category()));
              view += " and count(*) filter (where e.category = :category) > 0";
            }
            yield view;
          }
        };
    sql.append(" group by e.thread_id having ").append(having);
    if (after != null) {
      params.put("afterAt", utc(after.lastMessageAt()));
      params.put("afterId", after.threadId());
      sql.append(" and (max(e.last_message_at), e.thread_id) < (:afterAt, :afterId)");
    }
    sql.append(" order by last_at desc, e.thread_id desc limit :limit");
    return jdbc.sql(sql.toString())
        .params(params)
        .query(
            (rs, row) ->
                new Row(
                    rs.getObject("thread_id", UUID.class),
                    rs.getObject("last_at", OffsetDateTime.class).toInstant()))
        .list();
  }

  private static String view(MailboxView mailbox, Map<String, Object> params) {
    return switch (mailbox) {
      case INBOX -> {
        params.put("box", "inbox");
        yield IN_BOX + " and not " + BINNED + " and not " + SNOOZED;
      }
      case SPAM, TRASH -> {
        params.put("box", Wire.name(mailbox));
        yield IN_BOX;
      }
      case STARRED -> "bool_or(e.is_starred) and not " + BINNED;
      case IMPORTANT -> "bool_or(e.is_important) and not " + BINNED;
      case SNOOZED -> SNOOZED + " and not " + BINNED;
      case ALL -> "not " + BINNED;
      case SENT, SCHEDULED, OUTBOX, DRAFTS -> {
        params.put("box", Wire.name(mailbox));
        yield IN_BOX + " and not " + BINNED;
      }
    };
  }

  /** The Postgres driver binds OffsetDateTime, not Instant. */
  private static OffsetDateTime utc(Instant at) {
    return at.atOffset(ZoneOffset.UTC);
  }
}
