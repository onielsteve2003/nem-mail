package app.nemmail.api.search;

import app.nemmail.api.ai.Embedder;
import app.nemmail.api.common.PageResponse;
import app.nemmail.api.mail.ThreadService;
import app.nemmail.api.mail.ThreadSummaryResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Full-text search over the user's mail (FR-7.1, FR-7.2, FR-7.6), and by meaning (FR-7.5). */
@Service
class SearchService {

  private final SearchRepository search;
  private final ThreadService threads;
  private final Embedder embedder;

  SearchService(SearchRepository search, ThreadService threads, Embedder embedder) {
    this.search = search;
    this.threads = threads;
    this.embedder = embedder;
  }

  /**
   * One page of matching threads, ranked by {@code ts_rank} over the positive words (subject weighs
   * most, then sender, then body), newest first among equal ranks. A row's snippet becomes the
   * excerpt around the match when there is one. With {@code semantic}, the words also match by
   * meaning (hybrid ranking) when server embeddings are on; otherwise this stays a keyword search,
   * the non-AI fallback.
   */
  @Transactional(readOnly = true)
  public PageResponse<ThreadSummaryResponse> search(
      UUID userId, String query, boolean semantic, String cursor, int limit) {
    List<SearchClause> clauses = QueryParser.parse(query);
    if (clauses.isEmpty()) {
      return new PageResponse<>(List.of(), null);
    }
    String terms =
        clauses.stream()
            .filter(c -> c.kind() == SearchClause.Kind.TEXT && !c.negated())
            .map(SearchClause::value)
            .collect(Collectors.joining(" "));
    SearchCursor after = SearchCursor.decode(cursor);
    float[] vector = semantic ? embed(terms) : null;
    // One extra row says whether another page follows.
    List<SearchRepository.Hit> hits =
        vector != null
            ? search.semanticPage(userId, clauses, terms, vector, after, limit + 1)
            : search.page(userId, clauses, terms, after, limit + 1);
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

  /** The query's words as a MiniLM vector, or null when there are none or embeddings are off. */
  private float[] embed(String terms) {
    if (terms.isEmpty() || !embedder.ready()) {
      return null;
    }
    return embedder
        .embed(List.of(terms))
        .map(List::getFirst)
        .filter(vector -> vector.length == Embedding.DIMENSIONS)
        .orElse(null);
  }

  private static String oneLine(String text) {
    return text.replaceAll("\\s+", " ").strip();
  }
}
