package app.nemmail.api.mail;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailThreadRepository extends JpaRepository<MailThread, UUID> {}
