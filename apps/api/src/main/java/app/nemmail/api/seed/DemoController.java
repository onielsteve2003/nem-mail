package app.nemmail.api.seed;

import app.nemmail.api.common.ApiException;
import app.nemmail.api.common.ErrorCode;
import app.nemmail.api.config.ApiProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The reset the nightly GitHub Actions cron calls. Spring Security lets it through; a shared key
 * guards it instead, since the caller is a workflow, not a user.
 */
@RestController
class DemoController {

  static final String KEY_HEADER = "X-Demo-Reset-Key";

  private final DemoService demo;
  private final byte[] resetKey;

  DemoController(DemoService demo, ApiProperties properties) {
    this.demo = demo;
    String key = properties.demo().resetKey();
    this.resetKey = key == null || key.isBlank() ? null : key.getBytes(StandardCharsets.UTF_8);
  }

  @PostMapping("/admin/demo/reset")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void reset(@RequestHeader(name = KEY_HEADER, required = false) String key) {
    if (resetKey == null) {
      throw new ApiException(ErrorCode.NOT_FOUND, "Not found.");
    }
    // Constant time, so the key cannot be guessed byte by byte from response times.
    if (key == null || !MessageDigest.isEqual(resetKey, key.getBytes(StandardCharsets.UTF_8))) {
      throw new ApiException(ErrorCode.UNAUTHORIZED, "Wrong reset key.");
    }
    if (!demo.reset()) {
      throw new ApiException(ErrorCode.NOT_FOUND, "There is no demo seed to reset to.");
    }
  }
}
