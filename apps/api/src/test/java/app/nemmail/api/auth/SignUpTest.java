package app.nemmail.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@IntegrationTest
class SignUpTest {

  @Autowired private MockMvcTester mvc;
  @Autowired private UserRepository users;
  @Autowired private PasswordEncoder passwords;

  @Test
  void createsTheAccountWithAnArgon2idHash() {
    String email = TestData.email("Ada");

    MvcTestResult result =
        signUp(
            "{\"name\":\" Ada Lovelace \",\"email\":\"%s\",\"password\":\"analytical-engine\"}"
                .formatted(email.toUpperCase()));

    assertThat(result)
        .hasStatus(201)
        .hasHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
        .bodyJson()
        .hasPath("$.id")
        .hasPath("$.createdAt")
        .hasPath("$.avatarSeed")
        .hasPathSatisfying("$.email", value -> value.assertThat().isEqualTo(email))
        .hasPathSatisfying("$.name", value -> value.assertThat().isEqualTo("Ada Lovelace"))
        .doesNotHavePath("$.passwordHash");
    User user = users.findByEmailIgnoreCase(email).orElseThrow();
    assertThat(user.getPasswordHash()).startsWith("$argon2id$");
    assertThat(passwords.matches("analytical-engine", user.getPasswordHash())).isTrue();
  }

  @Test
  void rejectsADuplicateEmailIgnoringCase() {
    String email = TestData.email("Grace");
    String body = "{\"name\":\"Grace\",\"email\":\"%s\",\"password\":\"cobol-compiler\"}";

    assertThat(signUp(body.formatted(email))).hasStatus(201);
    assertThat(signUp(body.formatted(email.toUpperCase())))
        .hasStatus(409)
        .bodyJson()
        .extractingPath("$.error.code")
        .isEqualTo("CONFLICT");
  }

  @Test
  void validatesEveryField() {
    assertThat(signUp("{\"name\":\"\",\"email\":\"not-an-email\",\"password\":\"short\"}"))
        .hasStatus(422)
        .bodyJson()
        .extractingPath("$.error.details[*].field")
        .asArray()
        .containsExactlyInAnyOrder("name", "email", "password");
  }

  @Test
  void otherRoutesNeedASignedInUser() {
    assertThat(mvc.get().uri("/auth/signup")).hasStatus(401);
    assertThat(mvc.get().uri("/me"))
        .hasStatus(401)
        .bodyJson()
        .extractingPath("$.error.code")
        .isEqualTo("UNAUTHORIZED");
  }

  private MvcTestResult signUp(String json) {
    return mvc.post()
        .uri("/auth/signup")
        .contentType(MediaType.APPLICATION_JSON)
        .content(json)
        .exchange();
  }
}
