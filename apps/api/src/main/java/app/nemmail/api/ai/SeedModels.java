package app.nemmail.api.ai;

import app.nemmail.api.ai.model.CategoryModel;
import app.nemmail.api.ai.model.Corpora;
import app.nemmail.api.ai.model.NaiveBayes;
import app.nemmail.api.ai.model.NgramModel;
import app.nemmail.api.ai.model.PriorityModel;
import app.nemmail.api.ai.model.SpamModel;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The hand-written models trained on the shared seed corpora, as the app trains them on a fresh
 * device. Training takes a few milliseconds, so each call returns a new model a user's feedback can
 * change without touching anyone else's (per-user models are T18.3).
 */
@Component
public class SeedModels {

  private final Corpora corpora;

  SeedModels(JsonMapper json) {
    try (InputStream in = new ClassPathResource(Corpora.RESOURCE).getInputStream()) {
      corpora = json.readValue(in, Corpora.class);
    } catch (IOException e) {
      throw new UncheckedIOException("Missing " + Corpora.RESOURCE, e);
    }
  }

  public Corpora corpora() {
    return corpora;
  }

  public NaiveBayes spam() {
    return SpamModel.train(corpora.spamTraining());
  }

  public NaiveBayes category() {
    return CategoryModel.train(corpora.categories(), corpora.categoryTraining());
  }

  public PriorityModel.Logistic priority() {
    return PriorityModel.seed();
  }

  public NgramModel compose() {
    return NgramModel.train(corpora.composeSeed());
  }
}
