package app.nemmail.api.mail;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactRepository extends JpaRepository<Contact, UUID> {

  List<Contact> findByOwnerIdOrderByFrequencyDesc(UUID ownerId);
}
