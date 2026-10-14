package app.nemmail.api.ai.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Phishing rules, a port of {@code phishing.ts}: no model, a plain reason per signal. */
public final class Phishing {

  /** What the rules read; {@code bodyHtml} may be null. */
  public record Input(
      String fromName, String fromEmail, String subject, String bodyText, String bodyHtml) {}

  public record Finding(String signal, String reason) {}

  private static final Set<String> STRONG = Set.of("link-mismatch", "ip-link", "lookalike-domain");
  private static final Pattern URGENT =
      Pattern.compile(
          "\\b(urgent|immediately|suspend(?:ed)?|within 24 hours|act (?:now|fast)|final"
              + " (?:notice|warning)|account (?:will be )?(?:closed|locked))\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern CREDENTIALS =
      Pattern.compile(
          "\\b(verify|confirm|update|enter|re-?enter)\\b[^.!?\\n]{0,40}\\b(password|login|account"
              + " details|card (?:number|details)|bank details|ssn|pin)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern LOOKALIKE =
      Pattern.compile("[a-z][01][a-z]|[a-z]{2,}[01]\\b|\\b[01][a-z]{2,}", Pattern.CASE_INSENSITIVE);
  private static final Pattern IP_HOST = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}\\z");
  private static final Pattern ANCHOR =
      Pattern.compile(
          "<a\\b[^>]*?\\bhref\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)</a>",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern SHOWN_HOST =
      Pattern.compile("(?:https?://)?((?:[\\w-]+\\.)+[a-z]{2,})\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern URL =
      Pattern.compile("https?://[^" + Text.WS + "\"'<>)]+", Pattern.CASE_INSENSITIVE);

  /** Scheme, optional user info, then the host (WHATWG URL parsing, roughly). */
  private static final Pattern AUTHORITY =
      Pattern.compile(
          "^[a-z][a-z0-9+.-]*://(?:[^@/?#]*@)?(\\[[^\\]]*\\]|[^:/?#]*)", Pattern.CASE_INSENSITIVE);

  private Phishing() {}

  /** Runs every check; an empty list means nothing looked like phishing. */
  public static List<Finding> check(Input input) {
    List<Finding> findings = new ArrayList<>();
    String text = input.subject() + "\n" + input.bodyText();

    List<String> mismatches =
        input.bodyHtml() == null || input.bodyHtml().isEmpty()
            ? List.of()
            : linkMismatches(input.bodyHtml());
    if (!mismatches.isEmpty()) {
      findings.add(
          new Finding(
              "link-mismatch",
              "A link shows one address but opens another (" + mismatches.getFirst() + ")."));
    }
    if (linkHosts(input).stream().anyMatch(host -> IP_HOST.matcher(host).find())) {
      findings.add(new Finding("ip-link", "A link points to a bare IP address."));
    }
    String[] address = input.fromEmail().split("@", -1);
    String senderDomain = address.length > 1 ? address[1].toLowerCase(Locale.ROOT) : "";
    if (LOOKALIKE.matcher(senderDomain.split("\\.", -1)[0]).find()) {
      findings.add(
          new Finding(
              "lookalike-domain",
              "The sender's domain (" + senderDomain + ") swaps letters for numbers."));
    }
    if (CREDENTIALS.matcher(text).find()) {
      findings.add(
          new Finding(
              "credential-request", "It asks you to confirm a password or account details."));
    }
    if (URGENT.matcher(text).find()) {
      findings.add(new Finding("urgent-wording", "It uses urgent, threatening wording."));
    }
    return findings;
  }

  /** One strong signal, or a credential request with urgent wording. */
  public static boolean isPhishing(List<Finding> findings) {
    Set<String> signals = findings.stream().map(Finding::signal).collect(Collectors.toSet());
    if (signals.stream().anyMatch(STRONG::contains)) {
      return true;
    }
    return signals.contains("credential-request") && signals.contains("urgent-wording");
  }

  private static String hostOf(String url) {
    Matcher matcher = AUTHORITY.matcher(url);
    if (!matcher.find() || matcher.group(1).isEmpty()) {
      return null;
    }
    return matcher.group(1).toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
  }

  private static String siteOf(String host) {
    String[] labels = host.split("\\.", -1);
    return String.join(".", List.of(labels).subList(Math.max(0, labels.length - 2), labels.length));
  }

  private static List<String> linkMismatches(String html) {
    List<String> found = new ArrayList<>();
    Matcher anchor = ANCHOR.matcher(html);
    while (anchor.find()) {
      String target = hostOf(anchor.group(1));
      Matcher shown = SHOWN_HOST.matcher(anchor.group(2).replaceAll("<[^>]*>", "").strip());
      if (target == null || !shown.find()) {
        continue;
      }
      String shownHost = shown.group(1).toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
      if (!siteOf(shownHost).equals(siteOf(target))) {
        found.add(shownHost + " → " + target);
      }
    }
    return found;
  }

  private static List<String> linkHosts(Input input) {
    String text = input.bodyText() + " " + (input.bodyHtml() == null ? "" : input.bodyHtml());
    List<String> hosts = new ArrayList<>();
    Matcher url = URL.matcher(text);
    while (url.find()) {
      String host = hostOf(url.group());
      if (host != null) {
        hosts.add(host);
      }
    }
    return hosts;
  }
}
