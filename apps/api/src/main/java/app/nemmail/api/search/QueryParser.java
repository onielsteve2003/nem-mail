package app.nemmail.api.search;

import app.nemmail.api.search.SearchClause.Kind;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java port of {@code parseQuery} in @nem/shared (search/query-parser.ts): words, "quoted phrases",
 * {@code -}negation and the FR-7.2 operators. Both parsers run the cases in
 * packages/shared/fixtures/search-queries.json, so keep them in step.
 */
final class QueryParser {

  private static final Set<String> FIELD_OPERATORS = Set.of("from", "to", "subject", "label");
  private static final Set<String> IS_VALUES = Set.of("unread", "read", "starred");
  private static final Set<String> DATE_OPERATORS = Set.of("before", "after");
  private static final Pattern KEY = Pattern.compile("^([a-zA-Z]+):");
  private static final Pattern DATE = Pattern.compile("^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})$");

  private record RawToken(boolean negated, String key, String value, boolean quoted) {}

  private QueryParser() {}

  static List<SearchClause> parse(String input) {
    return tokenize(input).stream().map(QueryParser::toClause).toList();
  }

  /** Splits on whitespace, keeping "quoted phrases" (also after {@code key:}) together. */
  private static List<RawToken> tokenize(String input) {
    List<RawToken> tokens = new ArrayList<>();
    int i = 0;
    int n = input.length();
    while (i < n) {
      while (i < n && isSpace(input.charAt(i))) {
        i++;
      }
      if (i >= n) {
        break;
      }

      boolean negated = false;
      if (input.charAt(i) == '-' && i + 1 < n && !isSpace(input.charAt(i + 1))) {
        negated = true;
        i++;
      }

      String key = null;
      Matcher keyMatch = KEY.matcher(input.substring(i));
      if (keyMatch.find()) {
        int end = i + keyMatch.end();
        if (end < n && !isSpace(input.charAt(end))) {
          key = keyMatch.group(1).toLowerCase(Locale.ROOT);
          i = end;
        }
      }

      String value;
      boolean quoted = false;
      if (i < n && input.charAt(i) == '"') {
        int end = input.indexOf('"', i + 1);
        int stop = end == -1 ? n : end;
        value = input.substring(i + 1, stop);
        quoted = true;
        i = stop + 1;
      } else {
        int start = i;
        while (i < n && !isSpace(input.charAt(i))) {
          i++;
        }
        value = input.substring(start, i);
      }

      value = collapseSpaces(value);
      if (!value.isEmpty()) {
        tokens.add(new RawToken(negated, key, value, quoted));
      }
    }
    return tokens;
  }

  /** Normalizes 2026/3/7 or 2026-03-07 to 2026-03-07; null when it is not a real date. */
  static String parseDate(String value) {
    Matcher match = DATE.matcher(value);
    if (!match.matches()) {
      return null;
    }
    int year = Integer.parseInt(match.group(1));
    // Date.UTC in the TS parser maps years 0-99 to 1900-1999, so it rejects them.
    if (year < 100) {
      return null;
    }
    try {
      return LocalDate.of(year, Integer.parseInt(match.group(2)), Integer.parseInt(match.group(3)))
          .toString();
    } catch (DateTimeException e) {
      return null;
    }
  }

  private static SearchClause toClause(RawToken token) {
    String key = token.key();
    boolean negated = token.negated();
    String lower = token.value().toLowerCase(Locale.ROOT);

    if (key != null) {
      if (FIELD_OPERATORS.contains(key)) {
        return new SearchClause(Kind.valueOf(key.toUpperCase(Locale.ROOT)), lower, false, negated);
      }
      if (key.equals("has") && lower.equals("attachment")) {
        return new SearchClause(Kind.HAS, "attachment", false, negated);
      }
      if (key.equals("is") && IS_VALUES.contains(lower)) {
        return new SearchClause(Kind.IS, lower, false, negated);
      }
      if (DATE_OPERATORS.contains(key)) {
        String date = parseDate(token.value());
        if (date != null) {
          return new SearchClause(Kind.valueOf(key.toUpperCase(Locale.ROOT)), date, false, negated);
        }
      }
    }
    // Unknown operators and bad values search as plain text, like Gmail does.
    String text = key != null && !token.quoted() ? key + ":" + lower : lower;
    return new SearchClause(Kind.TEXT, text, token.quoted() || lower.contains(" "), negated);
  }

  /** JavaScript's {@code \s}, which the TS parser splits on. */
  private static boolean isSpace(char c) {
    return switch (c) {
      case ' ', 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0xA0, 0x1680, 0x2028, 0x2029 -> true;
      case 0x202F, 0x205F, 0x3000, 0xFEFF -> true;
      default -> c >= 0x2000 && c <= 0x200A;
    };
  }

  /** {@code value.trim().replace(/\s+/g, ' ')}. */
  private static String collapseSpaces(String value) {
    StringBuilder out = new StringBuilder(value.length());
    boolean pendingSpace = false;
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      if (isSpace(c)) {
        pendingSpace = true;
      } else {
        if (pendingSpace && !out.isEmpty()) {
          out.append(' ');
        }
        pendingSpace = false;
        out.append(c);
      }
    }
    return out.toString();
  }
}
