package app.nemmail.api.mail;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ContactRepository extends JpaRepository<Contact, UUID> {

  List<Contact> findByOwnerIdOrderByFrequencyDesc(UUID ownerId);

  /** Name or email contains the pattern; most frequent first, then most recent (mock order). */
  @Query(
      "select c from Contact c where c.ownerId = :ownerId"
          + " and (lower(c.email) like :pattern escape '\\'"
          + " or lower(c.name) like :pattern escape '\\')"
          + " order by c.frequency desc, c.lastContactedAt desc nulls last, c.email")
  List<Contact> search(UUID ownerId, String pattern, Limit limit);

  /** Adds one exchanged message with {@code email}, creating the contact on first contact. */
  @Modifying
  @Query(
      value =
          "insert into contacts (id, owner_id, email, name, last_contacted_at, frequency)"
              + " values (:id, :ownerId, :email, :name, :at, 1)"
              + " on conflict (owner_id, lower(email)) do update"
              + " set frequency = contacts.frequency + 1,"
              + " last_contacted_at = greatest(contacts.last_contacted_at, excluded.last_contacted_at),"
              + " name = coalesce(contacts.name, excluded.name)",
      nativeQuery = true)
  void record(UUID id, UUID ownerId, String email, String name, Instant at);
}
