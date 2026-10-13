package app.nemmail.api.auth;

import java.util.UUID;

/** The principal of an authenticated request: read it with {@code @AuthenticationPrincipal}. */
public record CurrentUser(UUID userId, UUID sessionId) {}
