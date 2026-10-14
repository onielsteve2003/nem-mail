package app.nemmail.api.search;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.PageResponse;
import app.nemmail.api.mail.ThreadSummaryResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SearchController {

  private final SearchService search;

  SearchController(SearchService search) {
    this.search = search;
  }

  /**
   * {@code ?q=<query>&cursor&limit}. {@code semantic} is accepted for the contract and ignored
   * until server embeddings (T18); semantic search runs on the device until then.
   */
  @GetMapping("/search")
  PageResponse<ThreadSummaryResponse> search(
      @AuthenticationPrincipal CurrentUser current,
      @RequestParam @NotBlank @Size(max = 500) String q,
      @RequestParam(defaultValue = "false") boolean semantic,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
    return search.search(current.userId(), q.strip(), cursor, limit);
  }
}
