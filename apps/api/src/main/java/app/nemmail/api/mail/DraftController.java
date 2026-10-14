package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.Ok;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Drafts CRUD; compose autosaves with PUT, so the client picks the id. */
@RestController
class DraftController {

  private final DraftService drafts;

  DraftController(DraftService drafts) {
    this.drafts = drafts;
  }

  @GetMapping("/drafts")
  List<DraftBody> list(@AuthenticationPrincipal CurrentUser current) {
    return drafts.list(current.userId());
  }

  @GetMapping("/drafts/{id}")
  DraftBody get(@AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    return drafts.get(current.userId(), id);
  }

  @PutMapping("/drafts/{id}")
  DraftBody save(
      @AuthenticationPrincipal CurrentUser current,
      @PathVariable UUID id,
      @Valid @RequestBody DraftBody body) {
    return drafts.save(current.userId(), id, body);
  }

  @DeleteMapping("/drafts/{id}")
  Ok delete(@AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    drafts.delete(current.userId(), id);
    return Ok.OK;
  }
}
