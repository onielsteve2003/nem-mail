package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import java.time.Instant;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class CountsController {

  private final CountsService counts;

  CountsController(CountsService counts) {
    this.counts = counts;
  }

  @GetMapping("/counts")
  CountsService.Response counts(@AuthenticationPrincipal CurrentUser current) {
    return counts.counts(current.userId(), Instant.now());
  }
}
