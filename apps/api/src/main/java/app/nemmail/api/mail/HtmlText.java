package app.nemmail.api.mail;

import java.util.regex.Pattern;

/** Plain text and snippets from compose HTML, as the mock's {@code htmlToText} does in the app. */
final class HtmlText {

  static final int SNIPPET_LENGTH = 140;

  private static final Pattern BREAKS =
      Pattern.compile("(?i)<br\s*/?>|</(p|div|li|h[1-6]|blockquote|tr)>");
  private static final Pattern TAGS = Pattern.compile("<[^>]*>");
  private static final Pattern SPACE = Pattern.compile("\s+");

  private HtmlText() {}

  static String text(String html) {
    String text = TAGS.matcher(BREAKS.matcher(html).replaceAll("\n")).replaceAll("");
    return text.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .strip();
  }

  static String snippet(String text) {
    String flat = SPACE.matcher(text).replaceAll(" ").strip();
    return flat.length() <= SNIPPET_LENGTH ? flat : flat.substring(0, SNIPPET_LENGTH);
  }
}
