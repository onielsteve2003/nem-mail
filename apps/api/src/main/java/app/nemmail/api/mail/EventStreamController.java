package app.nemmail.api.mail;

import app.nemmail.api.auth.CurrentUser;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
class EventStreamController {

  private final EventStream events;

  EventStreamController(EventStream events) {
    this.events = events;
  }

  /**
   * The realtime stream (ServerEventSchema). Bearer auth like every endpoint, so clients read it
   * with fetch rather than EventSource, which cannot send headers.
   */
  @GetMapping(path = "/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  SseEmitter stream(
      @AuthenticationPrincipal CurrentUser current,
      @RequestHeader(name = "Last-Event-ID", required = false) String lastEventId) {
    return events.open(current.userId(), lastEventId);
  }
}
