package app.nemmail.api.mail;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Recipient autocomplete over contacts collected as mail is delivered. */
@Service
public class ContactService {

  private final ContactRepository contacts;

  ContactService(ContactRepository contacts) {
    this.contacts = contacts;
  }

  /** Name or email matches; an empty query lists the top contacts. */
  @Transactional(readOnly = true)
  public List<Response> search(UUID userId, String q, int limit) {
    String needle =
        q.strip()
            .toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_");
    return contacts.search(userId, "%" + needle + "%", Limit.of(limit)).stream()
        .map(
            c ->
                new Response(
                    c.getId(), c.getEmail(), c.getName(), c.getLastContactedAt(), c.getFrequency()))
        .toList();
  }

  /** ContactSchema in @nem/shared. */
  public record Response(
      UUID id,
      String email,
      @JsonInclude(JsonInclude.Include.NON_NULL) String name,
      Instant lastContactedAt,
      int frequency) {}
}
