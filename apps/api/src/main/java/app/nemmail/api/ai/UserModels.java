package app.nemmail.api.ai;

import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.PriorityModel;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Each user's own models: the seed model until their first lesson, then their learned copy from
 * {@code ml_models} (same JSON shape as the app's saved models). Loads return a fresh object, so a
 * caller may train it and {@link #save} the result.
 */
@Component
public class UserModels {

  private final SeedModels seed;
  private final MlModelRepository models;
  private final JsonMapper json;

  UserModels(SeedModels seed, MlModelRepository models, JsonMapper json) {
    this.seed = seed;
    this.models = models;
    this.json = json;
  }

  public NaiveBayes spam(UUID userId) {
    return load(userId, ModelKind.SPAM, NaiveBayes.class).orElseGet(seed::spam);
  }

  public NaiveBayes category(UUID userId) {
    return load(userId, ModelKind.CATEGORY, NaiveBayes.class).orElseGet(seed::category);
  }

  public PriorityModel.Logistic priority(UUID userId) {
    return load(userId, ModelKind.PRIORITY, PriorityModel.Logistic.class).orElseGet(seed::priority);
  }

  /** Stores the user's model, creating the row on their first lesson. */
  public void save(UUID userId, ModelKind kind, Object model) {
    String params = json.writeValueAsString(model);
    models
        .findByUserIdAndKind(userId, kind)
        .ifPresentOrElse(
            row -> row.update(params),
            () -> models.save(new MlModel(UUID.randomUUID(), userId, kind, params)));
  }

  private <T> Optional<T> load(UUID userId, ModelKind kind, Class<T> type) {
    return models
        .findByUserIdAndKind(userId, kind)
        .map(row -> json.readValue(row.getParams(), type));
  }
}
