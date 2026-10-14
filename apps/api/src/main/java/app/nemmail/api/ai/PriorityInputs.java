package app.nemmail.api.ai;

import app.nemmail.api.ai.model.PriorityModel;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** What the priority model reads about one message, for one reader, gathered by SQL. */
@Component
class PriorityInputs {

  /** The message fields the features use. {@code category} is the reader's tab, may be null. */
  record Mail(
      UUID id, UUID threadId, String fromEmail, String subject, String bodyText, String category) {}

  private final JdbcClient jdbc;

  PriorityInputs(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  PriorityModel.Input input(UUID reader, Mail mail) {
    record Facts(
        boolean direct, int recipients, int messageCount, boolean attachments, int frequency) {}
    Facts facts =
        jdbc.sql(
                "select"
                    + " exists (select 1 from message_recipients where message_id = :message"
                    + "   and user_id = :reader and kind <> 'bcc') as direct,"
                    + " (select count(*) from message_recipients where message_id = :message)"
                    + "   as recipients,"
                    + " (select message_count from threads where id = :thread) as message_count,"
                    + " exists (select 1 from attachments where message_id = :message)"
                    + "   as attachments,"
                    // Delivery already counted the sender once; the model wants the history.
                    + " coalesce((select greatest(frequency - 1, 0) from contacts"
                    + "   where owner_id = :reader and lower(email) = lower(:from)), 0) as frequency")
            .param("message", mail.id())
            .param("reader", reader)
            .param("thread", mail.threadId())
            .param("from", mail.fromEmail())
            .query(Facts.class)
            .single();
    return new PriorityModel.Input(
        mail.fromEmail(),
        mail.subject(),
        mail.bodyText(),
        facts.direct(),
        facts.recipients(),
        facts.messageCount(),
        mail.category(),
        facts.attachments(),
        facts.frequency());
  }
}
