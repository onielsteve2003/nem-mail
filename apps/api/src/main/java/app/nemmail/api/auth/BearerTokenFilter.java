package app.nemmail.api.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Signs the request in when it carries {@code Authorization: Bearer <token>} for a live session. A
 * missing or bad token leaves it anonymous, and protected routes then answer 401. Added to the
 * Security chain only (not a bean), so the servlet container does not run it twice.
 */
public class BearerTokenFilter extends OncePerRequestFilter {

  private static final String PREFIX = "Bearer ";

  private final SessionService sessions;
  private final SecurityContextHolderStrategy contexts =
      SecurityContextHolder.getContextHolderStrategy();

  public BearerTokenFilter(SessionService sessions) {
    this.sessions = sessions;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (header != null && header.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
      sessions
          .authenticate(header.substring(PREFIX.length()).trim())
          .ifPresent(
              user -> {
                SecurityContext context = contexts.createEmptyContext();
                context.setAuthentication(
                    UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
                contexts.setContext(context);
              });
    }
    chain.doFilter(request, response);
  }
}
