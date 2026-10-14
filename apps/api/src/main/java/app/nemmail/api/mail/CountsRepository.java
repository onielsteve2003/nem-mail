package app.nemmail.api.mail;

import java.sql.Array;
import java.sql.SQLException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Each of a user's threads folded to the flags the badge counts need, in one query. */
@Repository
class CountsRepository {

  /** The thread as the list views see it: flags from any entry, the latest entry's tab. */
  record ThreadFlags(
      Set<String> mailboxes,
      boolean unread,
      boolean starred,
      boolean important,
      boolean snoozed,
      String category,
      List<UUID> labelIds) {}

  private final JdbcClient jdbc;

  CountsRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  List<ThreadFlags> threads(UUID userId, Instant now) {
    return jdbc.sql(
            "select array_remove(array_agg(distinct e.mailbox), null) as mailboxes,"
                + " bool_or(not e.is_read) as unread,"
                + " bool_or(e.is_starred) as starred,"
                + " bool_or(e.is_important) as important,"
                + " coalesce(bool_or(e.snoozed_until > :now), false) as snoozed,"
                + " (array_agg(e.category order by e.last_message_at desc)"
                + "   filter (where e.category is not null))[1] as category,"
                + " array_remove(array_agg(distinct l.label_id), null) as labels"
                + " from mailbox_entries e left join entry_labels l on l.entry_id = e.id"
                + " where e.user_id = :userId and e.deleted_at is null"
                + " group by e.thread_id")
        .params(Map.of("userId", userId, "now", now.atOffset(ZoneOffset.UTC)))
        .query(
            (rs, row) ->
                new ThreadFlags(
                    Set.of(strings(rs.getArray("mailboxes"))),
                    rs.getBoolean("unread"),
                    rs.getBoolean("starred"),
                    rs.getBoolean("important"),
                    rs.getBoolean("snoozed"),
                    rs.getString("category"),
                    List.of((UUID[]) rs.getArray("labels").getArray())))
        .list();
  }

  long drafts(UUID userId) {
    return jdbc.sql("select count(*) from drafts where user_id = :userId")
        .param("userId", userId)
        .query(Long.class)
        .single();
  }

  private static String[] strings(Array array) throws SQLException {
    return (String[]) array.getArray();
  }
}
