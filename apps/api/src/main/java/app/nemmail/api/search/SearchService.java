package app.nemmail.api.search;

import app.nemmail.api.common.PageResponse;
import app.nemmail.api.mail.ThreadService;
import app.nemmail.api.mail.ThreadSummaryResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Full-text search over the user's mail (FR-7.1, FR-7.2, FR-7.6). */
@Service
class SearchService {

  private final SearchRepository search;
  private final ThreadService threads;

  SearchService(SearchRepository search, ThreadService threads) {
    this.search = search;
    this.threads = threads;
  }

  /**
   * One page of matching threads, ranked by {@code ts_rank} over the positive words (subject weighs
   * most, then sender, then body), newest first among equal ranks. A row's snippet becomes the
   * excerpt around the match when there is one.
   */
  @Transactional(readOnly = true)
  public PageResponse<ThreadSummaryResponse> search(
      UUID userId, String query, String cursor, int limit) {
    List<SearchClause> clauses = QueryParser.parse(query);
    if (clauses.isEmpty()) {
      return new PageResponse<>(List.of(), null);
    }
    String terms =
        clauses.stream()
            .filter(c -> c.kind() == SearchClause.Kind.TEXT && !c.negated())
            .map(SearchClause::value)
            .collect(Collectors.joining(" "));
    // One extra row says whether another page follows.
    List<SearchRepository.Hit> hits =
        search.page(userId, clauses, terms, SearchCursor.decode(cursor), limit + 1);
    boolean hasMore = hits.size() > limit;
    List<SearchRepository.Hit> page = hasMore ? hits.subList(0, limit) : hits;
    List<UUID> ids = page.stream().map(SearchRepository.Hit::threadId).toList();
    Map<UUID, String> headlines = search.headlines(userId, ids, terms);
    List<ThreadSummaryResponse> items =
        threads.summaries(userId, ids).stream()
            .map(
                row -> {
                  String headline = headlines.get(row.id());
                  return headline == null ? row : row.withSnippet(oneLine(headline));
                })
            .toList();
    String next = null;
    if (hasMore) {
      SearchRepository.Hit last = page.getLast();
      next = new SearchCursor(last.rank(), last.lastMessageAt(), last.threadId()).encode();
    }
    return new PageResponse<>(items, next);
  }

  private static String oneLine(String text) {
    return text.replaceAll("\\s+", " ").strip();
  }
}
