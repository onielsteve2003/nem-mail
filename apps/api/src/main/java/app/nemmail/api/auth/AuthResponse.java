package app.nemmail.api.auth;

import java.time.Instant;

/** A new session: the client sends {@code token} as {@code Authorization: Bearer <token>}. */
public record AuthResponse(String token, Instant expiresAt, UserResponse user) {

  static AuthResponse of(SessionService.Issued session, User user) {
    return new AuthResponse(session.token(), session.expiresAt(), UserResponse.from(user));
  }
}
