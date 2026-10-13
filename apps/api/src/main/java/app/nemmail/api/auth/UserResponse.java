package app.nemmail.api.auth;

import java.time.Instant;
import java.util.UUID;

/** A user as the client sees it (UserSchema in @nem/shared). */
public record UserResponse(
    UUID id, String email, String name, String avatarSeed, Instant createdAt) {

  public static UserResponse from(User user) {
    return new UserResponse(
        user.getId(), user.getEmail(), user.getName(), user.getAvatarSeed(), user.getCreatedAt());
  }
}
