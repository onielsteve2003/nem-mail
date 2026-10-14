package app.nemmail.api.common;

/** OkSchema in @nem/shared: {@code { "ok": true }}. */
public record Ok(boolean ok) {

  public static final Ok OK = new Ok(true);
}
