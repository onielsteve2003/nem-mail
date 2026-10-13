package app.nemmail.api.auth;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final String EMAIL_TAKEN = "An account with this email already exists.";

  private final UserRepository users;
  private final PasswordEncoder passwords;

  AuthService(UserRepository users, PasswordEncoder passwords) {
    this.users = users;
    this.passwords = passwords;
  }

  /** Creates the account. Emails are stored trimmed and lowercased, and must be unique. */
  @Transactional
  public User signUp(SignUpRequest request) {
    String email = request.email().trim().toLowerCase(Locale.ROOT);
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ApiException(ErrorCode.CONFLICT, EMAIL_TAKEN);
    }
    User user =
        new User(
            UUID.randomUUID(),
            email,
            request.name().trim(),
            passwords.encode(request.password()),
            email);
    try {
      return users.saveAndFlush(user);
    } catch (DataIntegrityViolationException e) {
      // Two sign-ups with the same email at once: the unique index decides.
      throw new ApiException(ErrorCode.CONFLICT, EMAIL_TAKEN);
    }
  }
}
