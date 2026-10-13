package app.nemmail.api;

import static org.assertj.core.api.Assertions.assertThat;

import app.nemmail.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

@IntegrationTest
class FlywayTest {

  @Autowired private JdbcClient jdbc;

  @Test
  void migrationsRunOnStartup() {
    Integer applied =
        jdbc.sql("select count(*) from flyway_schema_history where success")
            .query(Integer.class)
            .single();
    String vector =
        jdbc.sql("select extversion from pg_extension where extname = 'vector'")
            .query(String.class)
            .single();

    assertThat(applied).isPositive();
    assertThat(vector).isNotBlank();
  }
}
