package app.nemmail.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /auth/signin}. Same password cap as sign-up, so nothing huge is hashed. */
public record SignInRequest(
    @NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {}
