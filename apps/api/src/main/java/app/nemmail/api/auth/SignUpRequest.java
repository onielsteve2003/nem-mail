package app.nemmail.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /auth/signup}. The password is 8 to 128 characters: long passphrases are welcome, but
 * the cap stops huge inputs from being hashed.
 */
public record SignUpRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank @Email @Size(max = 254) String email,
    @NotNull @Size(min = 8, max = 128) String password) {}
