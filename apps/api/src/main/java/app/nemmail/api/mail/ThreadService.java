package app.nemmail.api.mail;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import app.nemmail.api.common.PageResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reading a user's threads: list pages and single threads. */
@Service
public class ThreadService {

  private final ThreadListRepository lists;
  private final ThreadAssembler assembler;

  ThreadService(ThreadListRepository lists, ThreadAssembler assembler) {
    this.lists = lists;
    this.assembler = assembler;
  }

  /** One page of a mailbox, tab or label, newest first. */
  @Transactional(readOnly = true)
  public PageResponse<ThreadSummaryResponse> list(
      UUID userId, ThreadFilter filter, String cursor, int limit) {
    // One extra row says whether another page follows.
    List<ThreadListRepository.Row> rows =
        lists.page(userId, filter, ThreadCursor.decode(cursor), limit + 1, Instant.now());
    boolean hasMore = rows.size() > limit;
    List<ThreadListRepository.Row> page = hasMore ? rows.subList(0, limit) : rows;
    List<ThreadSummaryResponse> items =
        assembler
            .load(userId, page.stream().map(ThreadListRepository.Row::threadId).toList())
            .stream()
            .map(assembler::summary)
            .toList();
    String next = null;
    if (hasMore) {
      ThreadListRepository.Row last = page.getLast();
      next = new ThreadCursor(last.lastMessageAt(), last.threadId()).encode();
    }
    return new PageResponse<>(items, next);
  }

  /** List rows for {@code threadIds}, in that order; threads the user cannot see are skipped. */
  @Transactional(readOnly = true)
  public List<ThreadSummaryResponse> summaries(UUID userId, List<UUID> threadIds) {
    return assembler.load(userId, threadIds).stream().map(assembler::summary).toList();
  }

  /** One thread with its messages; 404 when the user has no message in it. */
  @Transactional(readOnly = true)
  public ThreadResponse get(UUID userId, UUID threadId) {
    return assembler.load(userId, List.of(threadId)).stream()
        .findFirst()
        .map(loaded -> assembler.thread(userId, loaded))
        .orElseThrow(
            () -> new ApiException(ErrorCode.NOT_FOUND, "This conversation was not found."));
  }
}
