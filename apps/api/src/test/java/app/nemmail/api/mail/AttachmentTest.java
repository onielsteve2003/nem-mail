package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import tools.jackson.databind.JsonNode;

@IntegrationTest
class AttachmentTest {

  private static final String PASSWORD = "difference-engine";
  private static final byte[] TEXT = "Plans for the engine".getBytes(StandardCharsets.UTF_8);

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private DeliveryService delivery;

  private User grace;
  private String adaToken;
  private String graceToken;
  private String eveToken;

  @BeforeEach
  void setUp() {
    User ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    User eve = data.user("Eve", TestData.email("Eve"), passwords.encode(PASSWORD));
    adaToken = signIn(ada);
    graceToken = signIn(grace);
    eveToken = signIn(eve);
  }

  @Test
  void uploadsAndOnlyTheUploaderCanDownloadBeforeSending() {
    ResponseEntity<JsonNode> uploaded = upload(adaToken, "dir/plans.txt", "text/plain", TEXT);

    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    JsonNode file = uploaded.getBody();
    assertThat(file.get("filename").asString()).isEqualTo("plans.txt");
    assertThat(file.get("mime").asString()).isEqualTo("text/plain");
    assertThat(file.get("size").asInt()).isEqualTo(TEXT.length);

    ResponseEntity<byte[]> mine = download(adaToken, file.get("id").asString());
    assertThat(mine.getStatusCode().value()).isEqualTo(200);
    assertThat(mine.getBody()).isEqualTo(TEXT);
    assertThat(mine.getHeaders().getContentType().toString()).startsWith("text/plain");
    assertThat(mine.getHeaders().getContentDisposition().getType()).isEqualTo("attachment");
    assertThat(mine.getHeaders().getContentDisposition().getFilename()).isEqualTo("plans.txt");

    assertThat(download(graceToken, file.get("id").asString()).getStatusCode().value())
        .isEqualTo(404);
    assertThat(download(adaToken, UUID.randomUUID().toString()).getStatusCode().value())
        .isEqualTo(404);
  }

  @Test
  void rejectsLargeFilesAndContentThatDoesNotMatchItsType() {
    ResponseEntity<JsonNode> big =
        upload(adaToken, "big.bin", "application/octet-stream", new byte[10 * 1024 * 1024 + 1]);
    assertThat(big.getStatusCode().value()).isEqualTo(413);
    assertThat(big.getBody().get("error").get("code").asString()).isEqualTo("PAYLOAD_TOO_LARGE");

    ResponseEntity<JsonNode> fake = upload(adaToken, "photo.png", "image/png", TEXT);
    assertThat(fake.getStatusCode().value()).isEqualTo(422);

    ResponseEntity<JsonNode> exact =
        upload(adaToken, "full.bin", "application/octet-stream", new byte[10 * 1024 * 1024]);
    assertThat(exact.getStatusCode().value()).isEqualTo(200);
    byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0};
    assertThat(
            upload(adaToken, "photo.png", "IMAGE/PNG; q=1", png).getBody().get("mime").asString())
        .isEqualTo("image/png");
  }

  @Test
  void sendingSharesTheFileWithRecipientsAndUndoKeepsIt() {
    JsonNode file = upload(adaToken, "plans.txt", "text/plain", TEXT).getBody();
    String id = file.get("id").asString();

    JsonNode sent = send(draft(file));
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));

    JsonNode graces =
        api.as(graceToken)
            .get()
            .uri("/threads/" + sent.get("threadId").asString())
            .retrieve()
            .body(JsonNode.class);
    assertThat(graces.get("messages").get(0).get("attachments").get(0).get("id").asString())
        .isEqualTo(id);
    assertThat(graces.get("attachments").get(0).get("filename").asString()).isEqualTo("plans.txt");
    assertThat(download(graceToken, id).getBody()).isEqualTo(TEXT);
    assertThat(download(eveToken, id).getStatusCode().value()).isEqualTo(404);
    assertThat(searchIds(graceToken, "has:attachment"))
        .containsExactly(sent.get("threadId").asString());
    assertThat(searchIds(eveToken, "has:attachment")).isEmpty();

    // Undo a second send: the draft comes back with the file, still Ada's.
    JsonNode other = upload(adaToken, "more.txt", "text/plain", TEXT).getBody();
    JsonNode pending = send(draft(other));
    JsonNode restored =
        api.as(adaToken)
            .delete()
            .uri("/send/" + pending.get("messageId").asString())
            .retrieve()
            .body(JsonNode.class);
    assertThat(restored.get("attachments").get(0).get("id").asString())
        .isEqualTo(other.get("id").asString());
    assertThat(download(adaToken, other.get("id").asString()).getBody()).isEqualTo(TEXT);
  }

  @Test
  void needsABearerTokenAndAFilePart() {
    String id = upload(adaToken, "plans.txt", "text/plain", TEXT).getBody().get("id").asString();
    assertThat(
            api.http()
                .get()
                .uri("/attachments/" + id)
                .retrieve()
                .toEntity(byte[].class)
                .getStatusCode()
                .value())
        .isEqualTo(401);
    assertThat(upload(null, "plans.txt", "text/plain", TEXT).getStatusCode().value())
        .isEqualTo(401);
    assertThat(download(adaToken, "not-a-uuid").getStatusCode().value()).isEqualTo(400);

    MultiValueMap<String, Object> noFile = new LinkedMultiValueMap<>();
    noFile.add("other", "x");
    int status =
        api.as(adaToken)
            .post()
            .uri("/attachments")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(noFile)
            .retrieve()
            .toEntity(JsonNode.class)
            .getStatusCode()
            .value();
    assertThat(status).isBetween(400, 422);
  }

  private List<String> searchIds(String token, String q) {
    List<String> out = new java.util.ArrayList<>();
    api.as(token)
        .get()
        .uri("/search?q={q}", q)
        .retrieve()
        .body(JsonNode.class)
        .get("items")
        .forEach(item -> out.add(item.get("id").asString()));
    return out;
  }

  private ResponseEntity<JsonNode> upload(
      String token, String filename, String mime, byte[] bytes) {
    HttpHeaders part = new HttpHeaders();
    part.set(HttpHeaders.CONTENT_TYPE, mime);
    part.setContentDisposition(
        ContentDisposition.formData().name("file").filename(filename).build());
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add("file", new HttpEntity<>(bytes, part));
    return (token == null ? api.http() : api.as(token))
        .post()
        .uri("/attachments")
        .contentType(MediaType.MULTIPART_FORM_DATA)
        .body(body)
        .retrieve()
        .toEntity(JsonNode.class);
  }

  private ResponseEntity<byte[]> download(String token, String id) {
    return api.as(token).get().uri("/attachments/" + id).retrieve().toEntity(byte[].class);
  }

  private JsonNode send(Map<String, Object> draft) {
    return api.as(adaToken)
        .post()
        .uri("/send")
        .body(Map.of("draft", draft))
        .retrieve()
        .body(JsonNode.class);
  }

  private Map<String, Object> draft(JsonNode file) {
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", UUID.randomUUID().toString());
    draft.put("mode", "new");
    draft.put("threadId", null);
    draft.put("inReplyTo", null);
    draft.put("to", List.of(Map.of("email", grace.getEmail())));
    draft.put("cc", List.of());
    draft.put("bcc", List.of());
    draft.put("subject", "Plans");
    draft.put("bodyHtml", "<p>See attached.</p>");
    draft.put(
        "attachments",
        List.of(
            Map.of(
                "id", file.get("id").asString(),
                "filename", file.get("filename").asString(),
                "mime", file.get("mime").asString(),
                "size", file.get("size").asInt())));
    draft.put("scheduledAt", null);
    draft.put("updatedAt", Instant.now().toString());
    return draft;
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
