package app.nemmail.api.settings;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * SettingsSchema in @nem/shared. Every field has a default, so a partial body (or stored JSON from
 * an older version) comes back complete; unknown keys are dropped, as Zod strips them.
 */
public record SettingsBody(
    @Pattern(regexp = "system|dark|light") String theme,
    @Pattern(regexp = "compact|default|comfortable") String density,
    @Valid Swipe swipe,
    Map<String, Boolean> ai,
    @Size(max = 2000) String signature,
    Vacation vacation,
    Notifications notifications,
    @Pattern(regexp = "reply|replyAll") String defaultReply,
    Confirm confirm) {

  /** AI_FEATURES in @nem/shared; each is on until the user turns it off. */
  static final List<String> AI_FEATURES =
      List.of(
          "categories",
          "spam",
          "summary",
          "smartReply",
          "smartCompose",
          "priority",
          "semanticSearch",
          "toneCheck",
          "followUp",
          "extraction",
          "assistant",
          "unsubscribe");

  private static final String SWIPE_ACTION = "archive|delete|toggleRead|snooze|move|none";

  public SettingsBody {
    theme = theme != null ? theme : "dark";
    density = density != null ? density : "default";
    swipe = swipe != null ? swipe : new Swipe(null, null);
    Map<String, Boolean> toggles = new LinkedHashMap<>();
    for (String feature : AI_FEATURES) {
      Boolean on = ai != null ? ai.get(feature) : null;
      toggles.put(feature, on != null ? on : true);
    }
    ai = toggles;
    signature = signature != null ? signature : "";
    vacation = vacation != null ? vacation : new Vacation(null, null, null, null, null);
    notifications = notifications != null ? notifications : new Notifications(null);
    defaultReply = defaultReply != null ? defaultReply : "reply";
    confirm = confirm != null ? confirm : new Confirm(null, null, null);
  }

  public record Swipe(
      @Pattern(regexp = SWIPE_ACTION) String left, @Pattern(regexp = SWIPE_ACTION) String right) {
    public Swipe {
      left = left != null ? left : "archive";
      right = right != null ? right : "toggleRead";
    }
  }

  public record Vacation(
      Boolean enabled, String subject, String message, Instant startsAt, Instant endsAt) {
    public Vacation {
      enabled = enabled != null ? enabled : false;
      subject = subject != null ? subject : "";
      message = message != null ? message : "";
    }
  }

  public record Notifications(Boolean newMail) {
    public Notifications {
      newMail = newMail != null ? newMail : true;
    }
  }

  public record Confirm(Boolean delete, Boolean archive, Boolean send) {
    public Confirm {
      delete = delete != null ? delete : true;
      archive = archive != null ? archive : false;
      send = send != null ? send : false;
    }
  }
}
