package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ContactController {

  private final ContactService contacts;

  ContactController(ContactService contacts) {
    this.contacts = contacts;
  }

  /** {@code ?q=ada&limit=8} (ContactQuerySchema). */
  @GetMapping("/contacts")
  List<ContactService.Response> search(
      @AuthenticationPrincipal CurrentUser current,
      @RequestParam(defaultValue = "") @Size(max = 200) String q,
      @RequestParam(defaultValue = "8") @Min(1) @Max(20) int limit) {
    return contacts.search(current.userId(), q, limit);
  }
}
