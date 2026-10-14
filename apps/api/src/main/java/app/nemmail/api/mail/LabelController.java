package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import app.nemmail.api.common.Ok;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Labels CRUD; another user's label is a 404, the same as a missing one. */
@RestController
class LabelController {

  private final LabelService labels;

  LabelController(LabelService labels) {
    this.labels = labels;
  }

  @GetMapping("/labels")
  List<LabelRequest.Response> list(@AuthenticationPrincipal CurrentUser current) {
    return labels.list(current.userId()).stream().map(LabelRequest.Response::of).toList();
  }

  @PostMapping("/labels")
  LabelRequest.Response create(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody LabelRequest.Create body) {
    return LabelRequest.Response.of(labels.create(current.userId(), body));
  }

  @PatchMapping("/labels/{id}")
  LabelRequest.Response update(
      @AuthenticationPrincipal CurrentUser current,
      @PathVariable UUID id,
      @RequestBody LabelRequest.Update body) {
    return LabelRequest.Response.of(labels.update(current.userId(), id, body));
  }

  @DeleteMapping("/labels/{id}")
  Ok delete(@AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    labels.delete(current.userId(), id);
    return Ok.OK;
  }
}
