package app.nemmail.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The title, version and bearer scheme of the spec, so Swagger UI's Authorize button takes the
 * token from {@code POST /auth/signin} (the demo account works).
 */
@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

  private static final String BEARER = "bearer";

  @Bean
  OpenAPI openApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("Nem Mail API")
                .version("2.0")
                .description(
                    "REST API behind the Nem Mail app. Sign in with POST /auth/signin (demo:"
                        + " alex@nemmail.example / demo-account), then Authorize with the token.")
                .license(new License().name("MIT")))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER, new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer")))
        .addSecurityItem(new SecurityRequirement().addList(BEARER));
  }
}
