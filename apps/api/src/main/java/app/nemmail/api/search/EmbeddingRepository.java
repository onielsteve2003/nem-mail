package app.nemmail.api.search;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmbeddingRepository extends JpaRepository<Embedding, UUID> {}
