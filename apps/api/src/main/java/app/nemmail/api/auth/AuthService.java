package app.nemmail.api.auth;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final String EMAIL_TAKEN = "An account with this email already exists.";
  private static final String BAD_CREDENTIALS = "Email or password is incorrect.";

  private final UserRepository users;
  private final PasswordEncoder passwords;
  private final SessionService sessions;

  /** Checked when the email is unknown, so both failures take as long as a real check. */
  private final String unknownUserHash;

  AuthService(UserRepository users, PasswordEncoder passwords, SessionService sessions) {
    this.users = users;
    this.passwords = passwords;
    this.sessions = sessions;
    this.unknownUserHash = passwords.encode(UUID.randomUUID().toString());
  }

  /**
   * Creates the account and signs it in. Emails are stored trimmed and lowercased, and must be
   * unique.
   */
  @Transactional
  public AuthResponse signUp(SignUpRequest request) {
    String email = normalize(request.email());
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
      users.saveAndFlush(user);
    } catch (DataIntegrityViolationException e) {
      // Two sign-ups with the same email at once: the unique index decides.
      throw new ApiException(ErrorCode.CONFLICT, EMAIL_TAKEN);
    }
    return AuthResponse.of(sessions.issue(user), user);
  }

  /** A new session for a correct email and password; one message for every failure. */
  @Transactional
  public AuthResponse signIn(SignInRequest request) {
    Optional<User> user = users.findByEmailIgnoreCase(normalize(request.email()));
    String hash = user.map(User::getPasswordHash).orElse(unknownUserHash);
    if (!passwords.matches(request.password(), hash) || user.isEmpty()) {
      throw new ApiException(ErrorCode.UNAUTHORIZED, BAD_CREDENTIALS);
    }
    return AuthResponse.of(sessions.issue(user.get()), user.get());
  }

  public User get(CurrentUser current) {
    return users
        .findById(current.userId())
        .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sign in to continue."));
  }

  private static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
