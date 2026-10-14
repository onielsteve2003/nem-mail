package app.nemmail.api.settings;

import app.nemmail.api.auth.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SettingsController {

  private final SettingsService settings;

  SettingsController(SettingsService settings) {
    this.settings = settings;
  }

  @GetMapping("/settings")
  SettingsBody get(@AuthenticationPrincipal CurrentUser current) {
    return settings.get(current.userId());
  }

  /** Replaces the whole document; missing fields take their defaults. */
  @PutMapping("/settings")
  SettingsBody put(
      @AuthenticationPrincipal CurrentUser current, @Valid @RequestBody SettingsBody body) {
    return settings.save(current.userId(), body);
  }
}
