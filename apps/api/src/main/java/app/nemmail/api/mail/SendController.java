package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SendController {

  private final SendService sends;

  SendController(SendService sends) {
    this.sends = sends;
  }

  @PostMapping("/send")
  SendRequest.Response send(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody SendRequest body) {
    return sends.send(current.userId(), body);
  }

  /** Undo send or cancel a scheduled one; the message comes back as a draft. */
  @DeleteMapping("/send/{id}")
  DraftBody cancel(@AuthenticationPrincipal CurrentUser current, @PathVariable UUID id) {
    return sends.cancel(current.userId(), id);
  }
}
