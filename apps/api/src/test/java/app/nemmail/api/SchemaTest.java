package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.nemmail.api.auth.User;
import app.nemmail.api.auth.UserRepository;
import app.nemmail.api.mail.Category;
import app.nemmail.api.mail.Label;
import app.nemmail.api.mail.LabelColor;
import app.nemmail.api.mail.LabelRepository;
import app.nemmail.api.mail.MailThread;
import app.nemmail.api.mail.MailThreadRepository;
import app.nemmail.api.mail.Mailbox;
import app.nemmail.api.mail.MailboxEntry;
import app.nemmail.api.mail.MailboxEntryRepository;
import app.nemmail.api.mail.Message;
import app.nemmail.api.mail.MessageRepository;
import app.nemmail.api.mail.MessageStatus;
import app.nemmail.api.search.Embedding;
import app.nemmail.api.search.EmbeddingRepository;
import app.nemmail.api.support.IntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

/** Hibernate validates every entity at startup; this checks the mappings round-trip. */
@IntegrationTest
@Transactional
class SchemaTest {

  @Autowired private UserRepository users;
  @Autowired private MailThreadRepository threads;
  @Autowired private MessageRepository messages;
  @Autowired private MailboxEntryRepository entries;
  @Autowired private LabelRepository labels;
  @Autowired private EmbeddingRepository embeddings;
  @Autowired private JdbcClient jdbc;

  @Test
  void storesMailWithEnumsJsonLabelsAndFullTextSearch() {
    Instant now = Instant.parse("2026-10-13T09:00:00Z");
    User user = users.save(new User(UUID.randomUUID(), "ada@nemmail.example", "Ada", "x", "ada"));
    MailThread thread = threads.save(new MailThread(UUID.randomUUID(), "Engine notes", now));
    Message message =
        new Message(
            UUID.randomUUID(),
            thread.getId(),
            "grace@example.com",
            "Grace Hopper",
            "Engine notes",
            "The analytical engine weaves algebraic patterns.",
            "The analytical engine",
            now,
            MessageStatus.SENT);
    message.setAi("{\"priority\":{\"value\":0.8,\"confidence\":0.9}}");
    messages.save(message);
    Label work =
        labels.save(new Label(UUID.randomUUID(), user.getId(), "Work", LabelColor.VIOLET, null));
    MailboxEntry entry =
        new MailboxEntry(
            UUID.randomUUID(),
            user.getId(),
            message.getId(),
            thread.getId(),
            Mailbox.INBOX,
            Category.PRIMARY,
            now);
    entry.getLabelIds().add(work.getId());
    entries.saveAndFlush(entry);

    MailboxEntry loaded = entries.findByUserIdAndThreadId(user.getId(), thread.getId()).getFirst();
    assertThat(loaded.getMailbox()).isEqualTo(Mailbox.INBOX);
    assertThat(loaded.getLabelIds()).containsExactly(work.getId());
    // Scoped to this test's rows: other test classes commit mail to the shared database.
    assertThat(
            jdbc.sql("select mailbox from mailbox_entries where id = :id")
                .param("id", entry.getId())
                .query(String.class)
                .single())
        .isEqualTo("inbox");
    assertThat(
            jdbc.sql("select ai ->> 'priority' from messages where id = :id")
                .param("id", message.getId())
                .query(String.class)
                .single())
        .contains("0.8");
    assertThat(
            jdbc.sql(
                    "select count(*) from messages"
                        + " where id = :id and search @@ websearch_to_tsquery(:q)")
                .param("id", message.getId())
                .param("q", "engines")
                .query(Long.class)
                .single())
        .isEqualTo(1);
  }

  @Test
  void storesEmbeddingsAsPgvector() {
    Instant now = Instant.now();
    MailThread thread = threads.save(new MailThread(UUID.randomUUID(), "Hi", now));
    Message message =
        messages.save(
            new Message(
                UUID.randomUUID(),
                thread.getId(),
                "a@example.com",
                null,
                "Hi",
                "Hello",
                "Hello",
                now,
                MessageStatus.SENT));
    float[] vector = new float[Embedding.DIMENSIONS];
    vector[0] = 1f;
    embeddings.saveAndFlush(new Embedding(message.getId(), vector));

    Double similarity =
        jdbc.sql("select 1 - (vector <=> :q::vector) from embeddings")
            .param("q", "[1" + ",0".repeat(Embedding.DIMENSIONS - 1) + "]")
            .query(Double.class)
            .single();
    assertThat(similarity).isEqualTo(1.0);
  }

  @Test
  void rejectsDuplicateEmailsIgnoringCase() {
    users.saveAndFlush(new User(UUID.randomUUID(), "Bob@nemmail.example", "Bob", "x", "bob"));
    assertThat(users.existsByEmailIgnoreCase("bob@NEMMAIL.example")).isTrue();
    assertThatThrownBy(
            () ->
                users.saveAndFlush(
                    new User(UUID.randomUUID(), "bob@nemmail.example", "Bob", "x", "bob")))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
