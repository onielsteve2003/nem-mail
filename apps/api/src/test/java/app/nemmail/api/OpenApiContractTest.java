package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.ApiClient;
import app.nemmail.api.support.IntegrationTest;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.MissingNode;

/**
 * Keeps the springdoc OpenAPI spec in step with the client contract: every endpoint in {@code
 * packages/shared/fixtures/endpoints.json} (the ENDPOINTS map the app calls) must be in the spec
 * with the same method, and every field of each recorded response in {@code fixtures/api} must be
 * declared by that operation's response schema.
 */
@IntegrationTest
class OpenApiContractTest {

  @Autowired private ApiClient api;
  @Autowired private JsonMapper json;

  @Test
  void specServesEveryEndpointAndDeclaresEveryRecordedField() throws IOException {
    JsonNode spec = api.http().get().uri("/v3/api-docs").retrieve().body(JsonNode.class);
    assertThat(spec).isNotNull();
    List<String> problems = new ArrayList<>();
    int checkedFields = 0;

    for (Map.Entry<String, JsonNode> endpoint : read("shared/endpoints.json").properties()) {
      String name = endpoint.getKey();
      String method = endpoint.getValue().get("method").asString();
      // The client writes /threads/:id; the spec writes /threads/{id}.
      String path = endpoint.getValue().get("path").asString().replaceAll(":(\\w+)", "{$1}");
      JsonNode operation = spec.path("paths").path(path).path(method.toLowerCase(Locale.ROOT));
      if (operation.isMissingNode()) {
        problems.add(name + ": " + method + " " + path + " is not in the spec");
        continue;
      }
      JsonNode fixture = readIfPresent("shared/api/" + name + ".json");
      if (fixture != null) {
        checkedFields += check(spec, responseSchema(operation), fixture, name, problems);
      }
    }

    assertThat(problems).isEmpty();
    // Guards against a spec whose schemas are all untyped, which would check nothing.
    assertThat(checkedFields).isGreaterThan(100);
  }

  /** The schema of the operation's success response. */
  private static JsonNode responseSchema(JsonNode operation) {
    for (Map.Entry<String, JsonNode> response : operation.path("responses").properties()) {
      if (response.getKey().startsWith("2")) {
        for (Map.Entry<String, JsonNode> media : response.getValue().path("content").properties()) {
          return media.getValue().path("schema");
        }
      }
    }
    return MissingNode.getInstance();
  }

  /**
   * Walks a recorded value against its schema and reports every object field the schema does not
   * declare. Returns how many fields were checked.
   */
  private static int check(
      JsonNode spec, JsonNode schema, JsonNode value, String where, List<String> problems) {
    schema = resolve(spec, schema);
    if (value.isArray()) {
      int checked = 0;
      for (JsonNode item : value) {
        checked += check(spec, schema.path("items"), item, where + "[]", problems);
      }
      return checked;
    }
    if (!value.isObject() || !schema.has("properties")) {
      // Scalars, maps (additionalProperties) and untyped values have no field list to compare.
      return 0;
    }
    int checked = 0;
    for (Map.Entry<String, JsonNode> field : value.properties()) {
      JsonNode property = schema.path("properties").path(field.getKey());
      if (property.isMissingNode()) {
        problems.add(where + "." + field.getKey() + " is not in the response schema");
        continue;
      }
      checked++;
      if (!field.getValue().isNull()) {
        checked += check(spec, property, field.getValue(), where + "." + field.getKey(), problems);
      }
    }
    return checked;
  }

  /** Follows {@code $ref: #/components/schemas/X}. */
  private static JsonNode resolve(JsonNode spec, JsonNode schema) {
    String ref = schema.path("$ref").asString("");
    if (ref.isEmpty()) {
      return schema;
    }
    return spec.path("components").path("schemas").path(ref.substring(ref.lastIndexOf('/') + 1));
  }

  private JsonNode read(String resource) throws IOException {
    JsonNode node = readIfPresent(resource);
    assertThat(node).as(resource + " on the test classpath").isNotNull();
    return node;
  }

  private JsonNode readIfPresent(String resource) throws IOException {
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(resource)) {
      return in == null ? null : json.readTree(in);
    }
  }
}
