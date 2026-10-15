package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import jakarta.mail.Multipart;
import jakarta.mail.internet.MimeMessage;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;

/** Outside addresses go over SMTP when a mail server is configured (Mailpit locally). */
@IntegrationTest
class SmtpDeliveryTest {

  private static final String PASSWORD = "difference-engine";

  @MockitoBean private JavaMailSender smtp;
  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private DeliveryService delivery;

  @Test
  void sendsTextAndHtmlPartsWithoutABounce() throws Exception {
    User ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    String token = signIn(ada);
    Map<String, Object> draft =
        Map.ofEntries(
            Map.entry("id", UUID.randomUUID().toString()),
            Map.entry("mode", "new"),
            Map.entry("to", List.of(Map.of("email", "bob@outside.example"))),
            Map.entry("cc", List.of()),
            Map.entry("bcc", List.of()),
            Map.entry("subject", "Tea"),
            Map.entry("bodyHtml", "<p>Tea at <b>four</b>?</p>"),
            Map.entry("attachments", List.of()),
            Map.entry("updatedAt", Instant.now().toString()));
    JsonNode sent =
        api.as(token)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft))
            .retrieve()
            .body(JsonNode.class);

    assertThat(
            delivery.deliver(
                UUID.fromString(sent.get("messageId").asString()),
                Instant.parse(sent.get("sendAt").asString())))
        .isTrue();

    ArgumentCaptor<MimeMessage> mail = ArgumentCaptor.forClass(MimeMessage.class);
    verify(smtp).send(mail.capture());
    MimeMessage message = mail.getValue();
    message.saveChanges();
    assertThat(message.getSubject()).isEqualTo("Tea");
    assertThat(message.getAllRecipients())
        .extracting(Object::toString)
        .containsExactly("bob@outside.example");
    assertThat(message.getContent()).isInstanceOf(Multipart.class);
    assertThat(ids(token, "inbox")).isEmpty();
    assertThat(ids(token, "sent")).containsExactly(sent.get("threadId").asString());
  }

  private List<String> ids(String token, String mailbox) {
    JsonNode body =
        api.as(token).get().uri("/threads?mailbox=" + mailbox).retrieve().body(JsonNode.class);
    List<String> ids = new ArrayList<>();
    body.get("items").forEach(item -> ids.add(item.get("id").asString()));
    return ids;
  }

  private String signIn(User user) {
    return api.http()
        .post()
        .uri("/auth/signin")
        .body(Map.of("email", user.getEmail(), "password", PASSWORD))
        .retrieve()
        .body(JsonNode.class)
        .get("token")
        .asString();
  }
}
