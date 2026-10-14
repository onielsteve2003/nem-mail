package app.nemmail.api.search;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Search SQL over {@code messages.search} (a weighted tsvector with a GIN index). Each clause
 * becomes an aggregate condition over the thread's messages the user has, so a thread matches when
 * any of its messages does, as in the mock. Spam and Trash are left out. Fragments are constants;
 * values are always bound as parameters.
 */
@Repository
class SearchRepository {

  record Hit(UUID threadId, Instant lastMessageAt, float rank) {}

  /** MiniLM cosine below this is noise for short email texts (SEMANTIC_MIN in the app). */
  static final double SEMANTIC_MIN = 0.3;

  /** Plain text: the client marks the terms itself. */
  private static final String HEADLINE_OPTIONS =
      "StartSel=\"\", StopSel=\"\", MaxWords=30, MinWords=12, MaxFragments=1";

  private static final String SENDER_LIKE =
      "lower(m.from_email || ' ' || coalesce(m.from_name, '')) like :";

  private final JdbcClient jdbc;

  SearchRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** Up to {@code limit} matching threads after {@code after}, best rank first, then newest. */
  List<Hit> page(
      UUID userId, List<SearchClause> clauses, String rankTerms, SearchCursor after, int limit) {
    Map<String, Object> params = new HashMap<>();
    params.put("userId", userId);
    params.put("limit", limit);
    StringBuilder having =
        new StringBuilder("count(*) filter (where e.mailbox in ('spam', 'trash')) = 0");
    for (int i = 0; i < clauses.size(); i++) {
      having.append(" and ").append(condition(clauses.get(i), "p" + i, params));
    }
    String rank = "0::real";
    if (!rankTerms.isEmpty()) {
      params.put("rankTerms", rankTerms);
      rank = "sum(ts_rank(m.search, plainto_tsquery('english', :rankTerms)))::real";
    }
    StringBuilder sql =
        new StringBuilder("select s.thread_id, s.last_at, s.rank from (")
            .append("select e.thread_id, max(e.last_message_at) as last_at, ")
            .append(rank)
            .append(" as rank from mailbox_entries e join messages m on m.id = e.message_id")
            .append(" where e.user_id = :userId and e.deleted_at is null")
            .append(" group by e.thread_id having ")
            .append(having)
            .append(") s");
    if (after != null) {
      params.put("afterRank", after.rank());
      params.put("afterAt", utc(after.lastMessageAt()));
      params.put("afterId", after.threadId());
      sql.append(
          " where (s.rank, s.last_at, s.thread_id)"
              + " < (cast(:afterRank as real), :afterAt, :afterId)");
    }
    sql.append(" order by s.rank desc, s.last_at desc, s.thread_id desc limit :limit");
    return jdbc.sql(sql.toString())
        .params(params)
        .query(
            (rs, row) ->
                new Hit(
                    rs.getObject("thread_id", UUID.class),
                    rs.getObject("last_at", OffsetDateTime.class).toInstant(),
                    rs.getFloat("rank")))
        .list();
  }

  /**
   * Hybrid search (AI-7), the app's {@code hybridRank} in SQL. Operators still filter; the words
   * match by keyword or by meaning. Keyword hits score {@code 0.5 * keyword + 0.5 * similarity},
   * where {@code keyword} runs from 1 for the best {@code ts_rank} down to 0.5 for the last; a
   * thread with no keyword hit gets in on meaning alone ({@code 0.5 * similarity}) when its best
   * message is at least {@link #SEMANTIC_MIN} similar. Vectors are unit length, so cosine is {@code
   * 1 - (a <=> b)}.
   */
  List<Hit> semanticPage(
      UUID userId,
      List<SearchClause> clauses,
      String rankTerms,
      float[] queryVector,
      SearchCursor after,
      int limit) {
    Map<String, Object> params = new HashMap<>();
    params.put("userId", userId);
    params.put("limit", limit);
    params.put("rankTerms", rankTerms);
    params.put("vector", vectorLiteral(queryVector));
    params.put("min", SEMANTIC_MIN);
    StringBuilder having =
        new StringBuilder("count(*) filter (where e.mailbox in ('spam', 'trash')) = 0");
    StringBuilder keyword = new StringBuilder("true");
    for (int i = 0; i < clauses.size(); i++) {
      SearchClause clause = clauses.get(i);
      String condition = condition(clause, "p" + i, params);
      boolean words = clause.kind() == SearchClause.Kind.TEXT && !clause.negated();
      (words ? keyword : having).append(" and ").append(condition);
    }
    StringBuilder sql =
        new StringBuilder("select s.thread_id, s.last_at, s.rank from (")
            .append("select k.thread_id, k.last_at, (case when k.keyword then 0.5 * (1 - 0.5 *")
            .append(" (row_number() over (partition by k.keyword")
            .append(" order by k.lex desc, k.last_at desc, k.thread_id desc) - 1)::float8")
            .append(" / greatest(count(*) over (partition by k.keyword) - 1, 1)) else 0 end")
            .append(" + 0.5 * greatest(k.sim, 0))::real as rank from (")
            .append("select e.thread_id, max(e.last_message_at) as last_at,")
            .append(" sum(ts_rank(m.search, plainto_tsquery('english', :rankTerms))) as lex, ")
            .append(keyword)
            .append(" as keyword,")
            .append(" coalesce(max(1 - (v.vector <=> cast(:vector as vector))), 0) as sim")
            .append(" from mailbox_entries e join messages m on m.id = e.message_id")
            .append(" left join embeddings v on v.message_id = m.id")
            .append(" where e.user_id = :userId and e.deleted_at is null")
            .append(" group by e.thread_id having ")
            .append(having)
            .append(") k where k.keyword or k.sim >= :min) s");
    if (after != null) {
      params.put("afterRank", after.rank());
      params.put("afterAt", utc(after.lastMessageAt()));
      params.put("afterId", after.threadId());
      sql.append(
          " where (s.rank, s.last_at, s.thread_id)"
              + " < (cast(:afterRank as real), :afterAt, :afterId)");
    }
    sql.append(" order by s.rank desc, s.last_at desc, s.thread_id desc limit :limit");
    return jdbc.sql(sql.toString())
        .params(params)
        .query(
            (rs, row) ->
                new Hit(
                    rs.getObject("thread_id", UUID.class),
                    rs.getObject("last_at", OffsetDateTime.class).toInstant(),
                    rs.getFloat("rank")))
        .list();
  }

  /** pgvector's text form, {@code [0.1,0.2,...]}. */
  private static String vectorLiteral(float[] vector) {
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < vector.length; i++) {
      out.append(i == 0 ? "" : ",").append(vector[i]);
    }
    return out.append(']').toString();
  }

  /**
   * A {@code ts_headline} excerpt around the match (FR-7.6) from each thread's best-matching
   * message. Threads with no message matching every term are left out.
   */
  Map<UUID, String> headlines(UUID userId, List<UUID> threadIds, String terms) {
    if (threadIds.isEmpty() || terms.isEmpty()) {
      return Map.of();
    }
    Map<UUID, String> out = new HashMap<>();
    jdbc.sql(
            "select distinct on (e.thread_id) e.thread_id,"
                + " ts_headline('english', m.body_text, q, :options) as headline"
                + " from mailbox_entries e join messages m on m.id = e.message_id,"
                + " plainto_tsquery('english', :terms) q"
                + " where e.user_id = :userId and e.deleted_at is null"
                + " and e.thread_id in (:ids) and m.search @@ q"
                + " order by e.thread_id, ts_rank(m.search, q) desc, m.sent_at desc")
        .param("options", HEADLINE_OPTIONS)
        .param("terms", terms)
        .param("userId", userId)
        .param("ids", threadIds)
        .query(
            (RowCallbackHandler)
                rs -> out.put(rs.getObject("thread_id", UUID.class), rs.getString("headline")));
    return out;
  }

  /** The clause as a condition on the thread's group of rows, negation applied. */
  private static String condition(SearchClause clause, String p, Map<String, Object> params) {
    String value = clause.value();
    boolean invert = false;
    String row =
        switch (clause.kind()) {
          case TEXT -> {
            params.put(p, value);
            params.put(p + "l", like(value));
            String q = "phraseto_tsquery('english', :" + p + ")";
            // Stopword-only text has no lexemes, so it falls back to a substring match.
            yield "(numnode("
                + q
                + ") > 0 and m.search @@ "
                + q
                + ")"
                + " or (numnode("
                + q
                + ") = 0"
                + " and lower(m.subject || ' ' || m.body_text) like :"
                + p
                + "l)"
                + " or "
                + SENDER_LIKE
                + p
                + "l"
                + " or "
                + recipientLike(p + "l");
          }
          case FROM -> {
            params.put(p, like(value));
            yield SENDER_LIKE + p;
          }
          case TO -> {
            params.put(p, like(value));
            yield recipientLike(p);
          }
          case SUBJECT -> {
            params.put(p, like(value));
            yield "lower(m.subject) like :" + p;
          }
          case LABEL -> {
            // By name or "parent/child" path; label:big-plans also finds "big plans".
            params.put(p, List.of(value, value.replace('-', ' ')));
            yield "exists (select 1 from entry_labels el join labels l on l.id = el.label_id"
                + " left join labels lp on lp.id = l.parent_id where el.entry_id = e.id"
                + " and (lower(l.name) in (:"
                + p
                + ")"
                + " or lower(lp.name || '/' || l.name) in (:"
                + p
                + ")))";
          }
          case HAS -> "exists (select 1 from attachments a where a.message_id = m.id)";
          case IS -> {
            invert = value.equals("read");
            yield value.equals("starred") ? "e.is_starred" : "not e.is_read";
          }
          case BEFORE -> {
            params.put(p, dayStart(value));
            yield "m.sent_at < :" + p;
          }
          case AFTER -> {
            params.put(p, dayStart(value));
            yield "m.sent_at >= :" + p;
          }
        };
    String any = "coalesce(bool_or(" + row + "), false)";
    return clause.negated() != invert ? "not " + any : any;
  }

  /** To and Cc of the message; Bcc only when the user sent it, as in the thread view. */
  private static String recipientLike(String param) {
    return "exists (select 1 from message_recipients r where r.message_id = m.id"
        + " and (r.kind <> 'bcc' or m.from_user_id = :userId)"
        + " and lower(r.email || ' ' || coalesce(r.name, '')) like :"
        + param
        + ")";
  }

  /** Substring match with LIKE's wildcards taken literally. */
  private static String like(String value) {
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
  }

  /** Calendar days start at UTC midnight: the server does not know the client's time zone. */
  private static OffsetDateTime dayStart(String date) {
    return LocalDate.parse(date).atStartOfDay().atOffset(ZoneOffset.UTC);
  }

  private static OffsetDateTime utc(Instant at) {
    return at.atOffset(ZoneOffset.UTC);
  }
}
