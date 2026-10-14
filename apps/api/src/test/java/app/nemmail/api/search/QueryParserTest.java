package app.nemmail.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The shared cases (packages/shared/fixtures/search-queries.json) the TS parser also runs. */
class QueryParserTest {

  static Stream<Arguments> sharedCases() throws IOException {
    try (InputStream in =
        QueryParserTest.class.getResourceAsStream("/shared/search-queries.json")) {
      JsonNode cases = JsonMapper.builder().build().readTree(in);
      List<Arguments> out = new ArrayList<>();
      cases.forEach(c -> out.add(Arguments.of(c.get("query").asString(), c.get("clauses"))));
      return out.stream();
    }
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("sharedCases")
  void matchesTheTypeScriptParser(String query, JsonNode expected) {
    List<SearchClause> clauses = QueryParser.parse(query);

    assertThat(clauses).hasSize(expected.size());
    for (int i = 0; i < clauses.size(); i++) {
      SearchClause clause = clauses.get(i);
      JsonNode want = expected.get(i);
      assertThat(clause.kind().name().toLowerCase(Locale.ROOT))
          .isEqualTo(want.get("kind").asString());
      assertThat(clause.value()).isEqualTo(want.get("value").asString());
      assertThat(clause.negated()).isEqualTo(want.get("negated").asBoolean());
      if (want.has("phrase")) {
        assertThat(clause.phrase()).isEqualTo(want.get("phrase").asBoolean());
      }
    }
  }
}
