package app.nemmail.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Headers for a JSON-only API: nothing may be framed, sniffed or loaded from a response. Swagger UI
 * is the one HTML page, so it may load its own scripts, styles and images.
 */
class SecurityHeadersFilter extends OncePerRequestFilter {

  private static final String API_CSP = "default-src 'none'; frame-ancestors 'none'";
  private static final String SWAGGER_UI_CSP =
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';"
          + " frame-ancestors 'none'";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    response.setHeader(
        "Content-Security-Policy",
        request.getServletPath().startsWith("/swagger-ui") ? SWAGGER_UI_CSP : API_CSP);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (request.isSecure()) {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    chain.doFilter(request, response);
  }
}
