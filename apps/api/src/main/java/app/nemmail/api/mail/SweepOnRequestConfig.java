package app.nemmail.api.mail;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Runs {@link MailSweeper#sweepIfStale} before each API request is handled. */
@Configuration(proxyBeanMethods = false)
class SweepOnRequestConfig implements WebMvcConfigurer {

  private final MailSweeper sweeper;

  SweepOnRequestConfig(MailSweeper sweeper) {
    this.sweeper = sweeper;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(
        new HandlerInterceptor() {
          @Override
          public boolean preHandle(
              HttpServletRequest request, HttpServletResponse response, Object handler) {
            sweeper.sweepIfStale();
            return true;
          }
        });
  }
}
