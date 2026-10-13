package app.nemmail.api.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

/**
 * The full application on a random port against Testcontainers Postgres, with {@code
 * MockMvcTester}, {@link ApiClient} and {@link TestData} ready to autowire. Every class that uses
 * only this annotation shares one Spring context and one container.
 *
 * <p>The per-IP rate limits are raised so a suite of requests from localhost never trips it; {@code
 * ApiInfrastructureTest} checks the real limits in its own context.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(
    webEnvironment = WebEnvironment.RANDOM_PORT,
    properties = {
      "nem.rate-limit.requests-per-minute=100000",
      "nem.rate-limit.auth-requests-per-minute=100000",
      "nem.demo.reset-key=test-reset-key"
    })
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, ApiClient.class, TestData.class})
public @interface IntegrationTest {}
