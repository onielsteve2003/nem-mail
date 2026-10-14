package app.nemmail.api.settings;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** One Settings document per user; a user who never saved gets the defaults. */
@Service
public class SettingsService {

  private final UserSettingsRepository settings;
  private final JsonMapper json;

  SettingsService(UserSettingsRepository settings, JsonMapper json) {
    this.settings = settings;
    this.json = json;
  }

  /** Saved settings, with any newer fields filled from defaults. */
  @Transactional(readOnly = true)
  public SettingsBody get(UUID userId) {
    return settings
        .findById(userId)
        .map(saved -> json.readValue(saved.getData(), SettingsBody.class))
        .orElseGet(SettingsService::defaults);
  }

  @Transactional
  public SettingsBody save(UUID userId, SettingsBody body) {
    String data = json.writeValueAsString(body);
    settings
        .findById(userId)
        .ifPresentOrElse(
            saved -> saved.setData(data), () -> settings.save(new UserSettings(userId, data)));
    return body;
  }

  private static SettingsBody defaults() {
    return new SettingsBody(null, null, null, null, null, null, null, null, null);
  }
}
