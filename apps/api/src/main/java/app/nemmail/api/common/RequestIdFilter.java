package app.nemmail.api.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every request an ID (the caller's {@code X-Request-Id} when it is sane, else a new one),
 * puts it in the logging context and the response, and logs one line per request.
 */
public class RequestIdFilter extends OncePerRequestFilter {

  public static final String HEADER = "X-Request-Id";
  public static final String MDC_KEY = "requestId";

  private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
  private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String given = request.getHeader(HEADER);
    String id =
        given != null && SAFE_ID.matcher(given).matches() ? given : UUID.randomUUID().toString();
    MDC.put(MDC_KEY, id);
    response.setHeader(HEADER, id);
    long start = System.nanoTime();
    try {
      chain.doFilter(request, response);
    } finally {
      long ms = (System.nanoTime() - start) / 1_000_000;
      // Health is pinged to keep the free host awake; keep it out of the info log.
      (request.getServletPath().equals("/health") ? log.atDebug() : log.atInfo())
          .addKeyValue("http.method", request.getMethod())
          .addKeyValue("url.path", request.getRequestURI())
          .addKeyValue("http.status", response.getStatus())
          .addKeyValue("duration_ms", ms)
          .log(
              "{} {} {} {}ms",
              request.getMethod(),
              request.getRequestURI(),
              response.getStatus(),
              ms);
      MDC.remove(MDC_KEY);
    }
  }
}
