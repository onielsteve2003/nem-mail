package app.nemmail.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.auth.User;
import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import app.nemmail.api.support.TestData;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@IntegrationTest
class EventStreamTest {

  private static final String PASSWORD = "jacquard-loom";

  @Autowired private ApiClient api;
  @Autowired private TestData data;
  @Autowired private PasswordEncoder passwords;
  @Autowired private DeliveryService delivery;
  @Autowired private ThreadOpsService ops;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private JsonMapper json;
  @Autowired private EventStream stream;

  @Value("${local.server.port}")
  private int port;

  private final HttpClient http = HttpClient.newHttpClient();
  private final List<Stream<String>> open = new ArrayList<>();
  private User ada;
  private User grace;
  private String adaToken;
  private String graceToken;

  /** One SSE message: its id (null when none) and its JSON data. */
  private record Event(String id, JsonNode data) {}

  @BeforeEach
  void setUp() {
    ada = data.user("Ada", TestData.email("Ada"), passwords.encode(PASSWORD));
    grace = data.user("Grace", TestData.email("Grace"), passwords.encode(PASSWORD));
    adaToken = signIn(ada);
    graceToken = signIn(grace);
  }

  @AfterEach
  void close() {
    open.forEach(Stream::close);
  }

  @Test
  void streamsNewMailAndReplaysWhatAReconnectMissed() throws Exception {
    BlockingQueue<Event> first = stream(graceToken, null);
    Event hello = next(first);
    assertThat(hello.id()).isNull();
    assertThat(hello.data().get("type").asString()).isEqualTo("counts");
    assertThat(hello.data().get("counts").get("mailboxes").get("inbox").asInt()).isZero();

    JsonNode sent =
        api.as(adaToken)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft()))
            .retrieve()
            .body(JsonNode.class);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));

    Event mail = next(first);
    assertThat(mail.data().get("type").asString()).isEqualTo("mail.new");
    assertThat(mail.data().get("summary").get("id").asString())
        .isEqualTo(sent.get("threadId").asString());
    assertThat(mail.data().get("summary").get("isUnread").asBoolean()).isTrue();
    Event counts = next(first);
    assertThat(counts.data().get("counts").get("mailboxes").get("inbox").asInt()).isEqualTo(1);
    assertThat(Long.parseLong(counts.id())).isGreaterThan(Long.parseLong(mail.id()));

    // A client that saw only the counts snapshot reconnects: the snapshot, then the replay.
    BlockingQueue<Event> again = stream(graceToken, Long.toString(Long.parseLong(mail.id()) - 1));
    assertThat(next(again).data().get("type").asString()).isEqualTo("counts");
    assertThat(next(again).id()).isEqualTo(mail.id());
    assertThat(next(again).id()).isEqualTo(counts.id());
  }

  @Test
  void streamsWokenSnoozes() throws Exception {
    MailboxEntry entry =
        data.received(grace, "x@example.com", "Later", Instant.now().minusSeconds(120));
    entry.setRead(true);
    entry.setSnoozedUntil(Instant.now().minusSeconds(1));
    entries.saveAndFlush(entry);
    BlockingQueue<Event> events = stream(graceToken, null);
    next(events);

    ops.wakeDue(Instant.now());

    Event woke = next(events);
    assertThat(woke.data().get("type").asString()).isEqualTo("snooze.woke");
    assertThat(woke.data().get("summaries").get(0).get("id").asString())
        .isEqualTo(entry.getThreadId().toString());
    assertThat(next(events).data().get("type").asString()).isEqualTo("counts");
  }

  @Test
  void keepsEachUsersEventsToThemAndSendsHeartbeats() throws Exception {
    BlockingQueue<Event> adas = stream(adaToken, null);
    next(adas);
    BlockingQueue<String> comments = new LinkedBlockingQueue<>();
    BlockingQueue<Event> graces = stream(graceToken, "not-a-number", comments);
    assertThat(next(graces).data().get("type").asString()).isEqualTo("counts");

    JsonNode sent =
        api.as(adaToken)
            .post()
            .uri("/send")
            .body(Map.of("draft", draft()))
            .retrieve()
            .body(JsonNode.class);
    delivery.deliver(
        UUID.fromString(sent.get("messageId").asString()),
        Instant.parse(sent.get("sendAt").asString()));

    assertThat(next(graces).data().get("type").asString()).isEqualTo("mail.new");
    // The sender only gets new counts (Sent), never a mail.new for their own message.
    Event adasCounts = next(adas);
    assertThat(adasCounts.data().get("type").asString()).isEqualTo("counts");
    assertThat(adas.poll(500, TimeUnit.MILLISECONDS)).isNull();

    comments.clear();
    stream.heartbeat();
    assertThat(comments.poll(10, TimeUnit.SECONDS)).isEqualTo("heartbeat");
  }

  @Test
  void needsABearerToken() throws Exception {
    HttpResponse<Void> response =
        http.send(
            HttpRequest.newBuilder(URI.create(base() + "/events/stream")).build(),
            HttpResponse.BodyHandlers.discarding());
    assertThat(response.statusCode()).isEqualTo(401);
  }

  /** Reads the stream on a virtual thread, queueing each complete message. */
  private BlockingQueue<Event> stream(String token, String lastEventId) throws Exception {
    return stream(token, lastEventId, new LinkedBlockingQueue<>());
  }

  /** The same, also queueing each comment line's text (such as heartbeats). */
  private BlockingQueue<Event> stream(
      String token, String lastEventId, BlockingQueue<String> comments) throws Exception {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create(base() + "/events/stream"))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "text/event-stream");
    if (lastEventId != null) {
      request.header("Last-Event-ID", lastEventId);
    }
    HttpResponse<Stream<String>> response =
        http.send(request.build(), HttpResponse.BodyHandlers.ofLines());
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.headers().firstValue("Content-Type").orElse(""))
        .startsWith("text/event-stream");
    Stream<String> lines = response.body();
    open.add(lines);
    BlockingQueue<Event> queue = new LinkedBlockingQueue<>();
    Thread.ofVirtual()
        .start(
            () -> {
              String[] id = {null};
              StringBuilder payload = new StringBuilder();
              try {
                lines.forEach(
                    line -> {
                      if (line.startsWith(":")) {
                        comments.add(line.substring(1).strip());
                      } else if (line.startsWith("id:")) {
                        id[0] = line.substring(3).strip();
                      } else if (line.startsWith("data:")) {
                        payload.append(line.substring(5));
                      } else if (line.isEmpty() && !payload.isEmpty()) {
                        queue.add(new Event(id[0], json.readTree(payload.toString())));
                        id[0] = null;
                        payload.setLength(0);
                      }
                    });
              } catch (RuntimeException e) {
                // Closed by the test.
              }
            });
    return queue;
  }

  private static Event next(BlockingQueue<Event> queue) throws InterruptedException {
    Event event = queue.poll(10, TimeUnit.SECONDS);
    assertThat(event).as("an event within 10 s").isNotNull();
    return event;
  }

  private String base() {
    return "http://localhost:" + port + "/api/v1";
  }

  private Map<String, Object> draft() {
    Map<String, Object> draft = new HashMap<>();
    draft.put("id", UUID.randomUUID().toString());
    draft.put("mode", "new");
    draft.put("threadId", null);
    draft.put("inReplyTo", null);
    draft.put("to", List.of(Map.of("email", grace.getEmail())));
    draft.put("cc", List.of());
    draft.put("bcc", List.of());
    draft.put("subject", "Looms");
    draft.put("bodyHtml", "<p>Thanks for the punched cards, see you at the meeting.</p>");
    draft.put("attachments", List.of());
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
