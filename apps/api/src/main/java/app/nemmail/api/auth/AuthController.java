package app.nemmail.api.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AuthController {

  private final AuthService auth;
  private final SessionService sessions;

  AuthController(AuthService auth, SessionService sessions) {
    this.auth = auth;
    this.sessions = sessions;
  }

  @PostMapping("/auth/signup")
  @ResponseStatus(HttpStatus.CREATED)
  AuthResponse signUp(@Valid @RequestBody SignUpRequest body) {
    return auth.signUp(body);
  }

  @PostMapping("/auth/signin")
  AuthResponse signIn(@Valid @RequestBody SignInRequest body) {
    return auth.signIn(body);
  }

  /** The {@code { ok: true }} body the shared contract (OkSchema) expects. */
  record Ok(boolean ok) {}

  /** Ends this device's session only; other signed-in devices stay signed in. */
  @PostMapping("/auth/signout")
  Ok signOut(@AuthenticationPrincipal CurrentUser current) {
    sessions.revoke(current.sessionId());
    return new Ok(true);
  }

  @GetMapping("/me")
  UserResponse me(@AuthenticationPrincipal CurrentUser current) {
    return UserResponse.from(auth.get(current));
  }
}
