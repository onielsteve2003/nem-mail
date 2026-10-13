package app.nemmail.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class SessionTest {

  private static final String PASSWORD = "difference-engine";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private SessionRepository sessions;

  private User ada;

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
  }

  @Test
  void signInIssuesAnOpaqueTokenStoredOnlyAsItsHash() {
    ResponseEntity<JsonNode> response = signIn(ada.getEmail().toUpperCase(), PASSWORD);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    JsonNode body = response.getBody();
    String token = body.get("token").asString();
    byte[] raw = Base64.getUrlDecoder().decode(token);
    assertThat(raw).hasSize(32);
    assertThat(body.get("user").get("email").asString()).isEqualTo(ada.getEmail());
    Session session = sessions.findByTokenHash(SessionService.sha256(raw)).orElseThrow();
    assertThat(session.getUserId()).isEqualTo(ada.getId());
    assertThat(session.getExpiresAt())
        .isCloseTo(Instant.now().plus(Duration.ofDays(30)), within(1, ChronoUnit.MINUTES));
    assertThat(Instant.parse(body.get("expiresAt").asString()))
        .isCloseTo(session.getExpiresAt(), within(1, ChronoUnit.MILLIS));
  }

  @Test
  void wrongPasswordAndUnknownEmailFailTheSameWay() {
    ResponseEntity<JsonNode> wrong = signIn(ada.getEmail(), "not-the-password");
    ResponseEntity<JsonNode> unknown = signIn(TestData.email("Nobody"), PASSWORD);

    assertThat(wrong.getStatusCode().value()).isEqualTo(401);
    assertThat(unknown.getStatusCode().value()).isEqualTo(401);
    assertThat(wrong.getBody()).isEqualTo(unknown.getBody());
    assertThat(wrong.getBody().get("error").get("code").asString()).isEqualTo("UNAUTHORIZED");
  }

  @Test
  void meReturnsTheSignedInUser() {
    ResponseEntity<JsonNode> me =
        api.as(tokenFor(ada)).get().uri("/me").retrieve().toEntity(JsonNode.class);

    assertThat(me.getStatusCode().value()).isEqualTo(200);
    assertThat(me.getBody().get("id").asString()).isEqualTo(ada.getId().toString());
    assertThat(me.getBody().get("name").asString()).isEqualTo("Ada");
  }

  @Test
  void signOutEndsOnlyThisSession() {
    String phone = tokenFor(ada);
    String laptop = tokenFor(ada);

    assertThat(status(phone, "/auth/signout", true)).isEqualTo(200);
    assertThat(status(phone, "/me", false)).isEqualTo(401);
    assertThat(status(laptop, "/me", false)).isEqualTo(200);
  }

  @Test
  void expiredSessionsAreRejectedAndRemoved() {
    String token = tokenFor(ada);
    Session session = sessionOf(token);
    session.setExpiresAt(Instant.now().minusSeconds(1));
    sessions.saveAndFlush(session);

    assertThat(status(token, "/me", false)).isEqualTo(401);
    assertThat(sessions.findById(session.getId())).isEmpty();
  }

  @Test
  void usingASessionSlidesItsExpiryForward() {
    String token = tokenFor(ada);
    Session session = sessionOf(token);
    session.setExpiresAt(Instant.now().plus(Duration.ofDays(2)));
    sessions.saveAndFlush(session);

    assertThat(status(token, "/me", false)).isEqualTo(200);
    assertThat(sessionOf(token).getExpiresAt())
        .isCloseTo(Instant.now().plus(Duration.ofDays(30)), within(1, ChronoUnit.MINUTES));
  }

  @Test
  void malformedOrUnknownTokensAreUnauthorized() {
    assertThat(status("not base64 !", "/me", false)).isEqualTo(401);
    assertThat(status("c2hvcnQ", "/me", false)).isEqualTo(401);
    assertThat(status(Base64.getUrlEncoder().encodeToString(new byte[32]), "/me", false))
        .isEqualTo(401);
  }

  @Test
  void theBearerSchemeIsCaseInsensitiveAndOtherSchemesAreIgnored() {
    String token = tokenFor(ada);

    assertThat(withAuthorization("bearer " + token)).isEqualTo(200);
    assertThat(withAuthorization("BEARER  " + token)).isEqualTo(200);
    assertThat(withAuthorization("Basic " + token)).isEqualTo(401);
    assertThat(withAuthorization(token)).isEqualTo(401);
  }

  private int withAuthorization(String header) {
    return api.http()
        .get()
        .uri("/me")
        .header(HttpHeaders.AUTHORIZATION, header)
        .retrieve()
        .toBodilessEntity()
        .getStatusCode()
        .value();
  }

  private ResponseEntity<JsonNode> signIn(String email, String password) {
    return api.http()
        .post()
        .uri("/auth/signin")
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", email, "password", password))
        .retrieve()
        .toEntity(JsonNode.class);
  }

  private String tokenFor(User user) {
    return signIn(user.getEmail(), PASSWORD).getBody().get("token").asString();
  }

  private Session sessionOf(String token) {
    byte[] hash = SessionService.sha256(Base64.getUrlDecoder().decode(token));
    return sessions.findByTokenHash(hash).orElseThrow();
  }

  private int status(String token, String path, boolean post) {
    return api.as(token)
        .method(post ? HttpMethod.POST : HttpMethod.GET)
        .uri(path)
        .retrieve()
        .toBodilessEntity()
        .getStatusCode()
        .value();
  }
}
