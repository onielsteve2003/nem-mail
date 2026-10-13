package app.nemmail.api.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
class AuthController {

  private final AuthService auth;

  AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/signup")
  @ResponseStatus(HttpStatus.CREATED)
  UserResponse signUp(@Valid @RequestBody SignUpRequest body) {
    return UserResponse.from(auth.signUp(body));
  }
}
