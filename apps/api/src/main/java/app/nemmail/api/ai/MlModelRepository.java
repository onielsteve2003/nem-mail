package app.nemmail.api.ai;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MlModelRepository extends JpaRepository<MlModel, UUID> {

  List<MlModel> findByUserId(UUID userId);

  Optional<MlModel> findByUserIdAndKind(UUID userId, ModelKind kind);
}
