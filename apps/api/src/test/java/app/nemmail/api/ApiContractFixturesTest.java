package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.mail.DeliveryService;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Walks every mail endpoint the API serves, as the app would use them, and keeps each response
 * body. With {@code ./gradlew test -PwriteApiFixtures} they are written to {@code
 * packages/shared/fixtures/api/<endpoint>.json} (named after the ENDPOINTS keys in @nem/shared),
 * where Vitest parses each one with the endpoint's Zod response schema. Error envelopes are written
 * as {@code error.<case>.json}.
 */
@IntegrationTest
class ApiContractFixturesTest {

  private static final String PASSWORD = "bernoulli-numbers";

  @Autowired private ApiClient api;
  @Autowired private DeliveryService delivery;
  @Autowired private JsonMapper json;

  private final Map<String, JsonNode> fixtures = new TreeMap<>();

  @Test
  void everyMailEndpointAnswersItsContract() throws IOException {
    String adaEmail = TestData.email("Ada");
    JsonNode session =
        keep(
            "signUp",
            api.http()
                .post()
                .uri("/auth/signup")
                .body(Map.of("name", "Ada Lovelace", "email", adaEmail, "password", PASSWORD)),
            201);
    String graceEmail = TestData.email("Grace");
    signUp("Grace Hopper", graceEmail);
    String token =
        keep(
                "signIn",
                api.http()
                    .post()
                    .uri("/auth/signin")
                    .body(Map.of("email", adaEmail, "password", PASSWORD)),
                200)
            .get("token")
            .asString();
    assertThat(session.get("user").get("email").asString()).isEqualTo(adaEmail);
    RestClient ada = api.as(token);
    keep("me", ada.get().uri("/me"), 200);

    // Labels
    String work =
        keep(
                "createLabel",
                ada.post().uri("/labels").body(Map.of("name", "Work", "color", "lime")),
                200)
            .get("id")
            .asString();
    keep(
        "updateLabel",
        ada.patch().uri("/labels/" + work).body(Map.of("name", "Projects", "color", "cyan")),
        200);
    String old =
        ada.post()
            .uri("/labels")
            .body(Map.of("name", "Old", "color", "coral"))
            .retrieve()
            .body(JsonNode.class)
            .get("id")
            .asString();
    keep("deleteLabel", ada.delete().uri("/labels/" + old), 200);
    keep("listLabels", ada.get().uri("/labels"), 200);

    // Drafts
    String draftId = UUID.randomUUID().toString();
    Map<String, Object> draft = draft(draftId, graceEmail);
    keep("saveDraft", ada.put().uri("/drafts/" + draftId).body(draft), 200);
    keep("getDraft", ada.get().uri("/drafts/" + draftId), 200);
    keep("listDrafts", ada.get().uri("/drafts"), 200);
    String scrap = UUID.randomUUID().toString();
    ada.put().uri("/drafts/" + scrap).body(draft(scrap, graceEmail)).retrieve().toBodilessEntity();
    keep("deleteDraft", ada.delete().uri("/drafts/" + scrap), 200);

    // Send, deliver (Grace gets it, the outside address bounces), then undo another send.
    JsonNode sent = keep("send", ada.post().uri("/send").body(Map.of("draft", draft)), 200);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));
    String thread = sent.get("threadId").asString();
    String pending =
        ada.post()
            .uri("/send")
            .body(Map.of("draft", draft(UUID.randomUUID().toString(), graceEmail)))
            .retrieve()
            .body(JsonNode.class)
            .get("messageId")
            .asString();
    keep("cancelSend", ada.delete().uri("/send/" + pending), 200);

    // Threads
    ada.patch()
        .uri("/threads")
        .body(
            Map.of(
                "ids", List.of(thread), "op", Map.of("op", "addLabels", "labelIds", List.of(work))))
        .retrieve()
        .toBodilessEntity();
    keep(
        "bulkThreads",
        ada.patch()
            .uri("/threads")
            .body(Map.of("ids", List.of(thread), "op", Map.of("op", "star"))),
        200);
    JsonNode page = keep("listThreads", ada.get().uri("/threads?mailbox=inbox"), 200);
    assertThat(page.get("items").get(0).get("id").asString()).isEqualTo(thread);
    JsonNode full = keep("getThread", ada.get().uri("/threads/" + thread), 200);
    assertThat(full.get("messages")).hasSize(2);

    // Delete forever (Ada trashes the thread first) and empty (Grace spams her copy).
    ada.patch()
        .uri("/threads")
        .body(Map.of("ids", List.of(thread), "op", Map.of("op", "trash")))
        .retrieve()
        .toBodilessEntity();
    keep(
        "deleteThreads",
        ada.post().uri("/threads/delete").body(Map.of("ids", List.of(thread))),
        200);
    RestClient grace = api.as(signIn(graceEmail));
    grace
        .patch()
        .uri("/threads")
        .body(Map.of("ids", List.of(thread), "op", Map.of("op", "spam")))
        .retrieve()
        .toBodilessEntity();
    keep("emptyMailbox", grace.delete().uri("/mailboxes/spam"), 200);

    // Contacts, settings, counts
    keep("listContacts", ada.get().uri("/contacts?q=&limit=8"), 200);
    keep("getSettings", ada.get().uri("/settings"), 200);
    keep(
        "putSettings",
        ada.put().uri("/settings").body(Map.of("theme", "light", "ai", Map.of("summary", false))),
        200);
    keep("counts", ada.get().uri("/counts"), 200);

    // The error envelope
    keep(
        "error.validation",
        ada.post().uri("/labels").body(Map.of("name", "", "color", "lime")),
        422);
    keep("error.notFound", ada.get().uri("/threads/" + UUID.randomUUID()), 404);
    keep("error.unauthorized", api.http().get().uri("/me"), 401);

    keep("signOut", ada.post().uri("/auth/signout").body(Map.of()), 200);

    write();
  }

  private JsonNode keep(String name, RestClient.RequestHeadersSpec<?> request, int status) {
    ResponseEntity<JsonNode> response = request.retrieve().toEntity(JsonNode.class);
    assertThat(response.getStatusCode().value()).as(name).isEqualTo(status);
    assertThat(response.getBody()).as(name).isNotNull();
    fixtures.put(name, response.getBody());
    return response.getBody();
  }

  private String signIn(String email) {
    return api.http()
        .post()
        .uri("/auth/signin")
        .body(Map.of("email", email, "password", PASSWORD))
        .retrieve()
        .body(JsonNode.class)
        .get("token")
        .asString();
  }

  private void signUp(String name, String email) {
    api.http()
        .post()
        .uri("/auth/signup")
        .body(Map.of("name", name, "email", email, "password", PASSWORD))
        .retrieve()
        .toBodilessEntity();
  }

  /** Only with -PwriteApiFixtures; a normal build leaves the committed fixtures alone. */
  private void write() throws IOException {
    String dir = System.getProperty("nem.apiFixtures");
    if (dir == null) {
      return;
    }
    Path out = Path.of(dir);
    Files.createDirectories(out);
    for (Map.Entry<String, JsonNode> fixture : fixtures.entrySet()) {
      Files.writeString(
          out.resolve(fixture.getKey() + ".json"),
          json.writerWithDefaultPrettyPrinter().writeValueAsString(fixture.getValue()) + "\n");
    }
  }

  private static Map<String, Object> draft(String id, String to) {
    return Map.ofEntries(
        Map.entry("id", id),
        Map.entry("mode", "new"),
        Map.entry("to", List.of(Map.of("email", to, "name", "Grace Hopper"))),
        Map.entry("cc", List.of(Map.of("email", "bob@outside.example"))),
        Map.entry("bcc", List.of()),
        Map.entry("subject", "Compiler notes"),
        Map.entry("bodyHtml", "<p>Shall we compare <b>notes</b> on Friday?</p>"),
        Map.entry("attachments", List.of()),
        Map.entry("updatedAt", Instant.now().toString()));
  }
}
