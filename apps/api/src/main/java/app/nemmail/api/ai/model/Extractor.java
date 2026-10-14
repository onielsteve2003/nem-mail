package app.nemmail.api.ai.model;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Codes, tracking numbers, dates and meeting times (AI-10), a port of {@code extract.ts}. Relative
 * dates ("Friday") resolve from the send day in the reader's time zone.
 */
public final class Extractor {

  /** The message to look through; {@code sentAt} anchors "today" and weekdays. */
  public record Input(String subject, String text, Instant sentAt) {}

  /** One chip: {@code kind} is date, meeting, tracking or otp. */
  public record Extraction(String kind, String text, String value) {}

  public static final int MAX_EXTRACTIONS = 4;

  private static final Map<String, Double> CONFIDENCE =
      Map.of("otp", 0.9, "tracking", 0.85, "meeting", 0.8, "date", 0.7);
  private static final Map<String, String> KIND_NAMES =
      Map.of(
          "otp", "a one-time code",
          "tracking", "a tracking number",
          "meeting", "a meeting time",
          "date", "a date");

  private static Pattern ci(String regex) {
    return Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
  }

  private static final Pattern OTP_AFTER =
      ci("\\b(?:code|passcode|otp|pin)\\b[^\\d\\n]{0,25}?\\b(\\d{4,8})\\b");
  private static final Pattern OTP_BEFORE =
      ci(
          "\\b(\\d{4,8})\\b[^\\d\\n]{0,20}\\b(?:verification|security|login|one-time)?["
              + Text.WS
              + "]*code\\b");
  private static final Pattern TRACKING_LABEL =
      ci(
          "\\btracking["
              + Text.WS
              + "]*(?:number|no\\.?|#|id|code)?["
              + Text.WS
              + "]*[:#]?["
              + Text.WS
              + "]*([A-Z0-9][A-Z0-9-]{7,29})\\b");
  private static final Pattern UPS = Pattern.compile("\\b1Z[0-9A-Z]{16}\\b");
  private static final Pattern DIGIT = Pattern.compile("\\d");

  private static final List<String> WEEKDAYS =
      List.of("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday");
  private static final List<String> MONTHS =
      List.of("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec");
  private static final String S = "[" + Text.WS + "]";
  private static final String MONTH =
      "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
  private static final List<Pattern> DATE_PATTERNS =
      List.of(
          ci("\\b(\\d{4})-(\\d{2})-(\\d{2})\\b"),
          ci("\\b" + MONTH + S + "+(\\d{1,2})(?:st|nd|rd|th)?(?:,?" + S + "+(\\d{4}))?\\b"),
          ci(
              "\\b(\\d{1,2})(?:st|nd|rd|th)?"
                  + S
                  + "+(?:of"
                  + S
                  + "+)?"
                  + MONTH
                  + "(?:,?"
                  + S
                  + "+(\\d{4}))?\\b"),
          ci(
              "\\b(today|tomorrow|(?:next"
                  + S
                  + "+)?(?:sun|mon|tues|wednes|thurs|fri|satur)day)\\b"));

  /** A time needs a colon or am/pm, so "3 people" is not a time. */
  private static final Pattern TIME =
      ci(
          "^[^.!?\\n]{0,12}?\\b(?:(\\d{1,2}):(\\d{2})"
              + S
              + "*([ap]\\.?m\\.?)?|(\\d{1,2})"
              + S
              + "*([ap]\\.?m\\.?))(?![\\w:])");

  private static final Pattern MEETING_WORDS =
      ci(
          "\\b(meet|meeting|call|sync|interview|lunch|dinner|coffee|appointment|invit\\w*|calendar|standup|demo)\\b");
  private static final Pattern NEXT = ci("^next" + S + "+");
  private static final Pattern SENTENCE_END = Pattern.compile("[.!?\\n]");

  private record Time(String value, int length) {}

  private record Hit(int index, Extraction item) {}

  private Extractor() {}

  /** Everything found, at most four chips; null when nothing was found. */
  public static AiInsight<List<Extraction>> extract(Input input, ZoneId zone) {
    String text = input.subject() + "\n" + TextRank.ownText(input.text());
    LocalDate today = input.sentAt().atZone(zone).toLocalDate();
    List<Extraction> found = new ArrayList<>();

    Matcher otp = OTP_AFTER.matcher(text);
    if (!otp.find()) {
      otp = OTP_BEFORE.matcher(text);
      otp = otp.find() ? otp : null;
    }
    if (otp != null && otp.group(1) != null) {
      add(found, new Extraction("otp", otp.group(1), otp.group(1)));
    }

    Matcher tracking = UPS.matcher(text);
    String number = null;
    if (tracking.find()) {
      number = tracking.group();
    } else {
      tracking = TRACKING_LABEL.matcher(text);
      if (tracking.find()) {
        number = tracking.group(1);
      }
    }
    if (number != null) {
      number = number.toUpperCase(Locale.ROOT);
      if (DIGIT.matcher(number).find()) {
        add(found, new Extraction("tracking", number, number));
      }
    }

    findDates(text, today).forEach(item -> add(found, item));

    if (found.isEmpty()) {
      return null;
    }
    List<Extraction> value = List.copyOf(found.subList(0, Math.min(MAX_EXTRACTIONS, found.size())));
    LinkedHashSet<String> kinds = new LinkedHashSet<>();
    value.forEach(item -> kinds.add(item.kind()));
    double confidence = kinds.stream().mapToDouble(CONFIDENCE::get).max().orElse(0);
    return new AiInsight<>(
        value,
        confidence,
        "Found "
            + listNames(kinds.stream().map(KIND_NAMES::get).toList())
            + " by pattern matching on the server.",
        AiInsight.HEURISTIC);
  }

  private static void add(List<Extraction> found, Extraction item) {
    if (found.stream()
        .noneMatch(
            other -> other.kind().equals(item.kind()) && other.value().equals(item.value()))) {
      found.add(item);
    }
  }

  private static List<Extraction> findDates(String text, LocalDate today) {
    List<Hit> hits = new ArrayList<>();
    for (Pattern pattern : DATE_PATTERNS) {
      Matcher match = pattern.matcher(text);
      while (match.find()) {
        LocalDate day = resolveDay(match, today);
        if (day == null) {
          continue;
        }
        int end = match.end();
        Time time = parseTime(text.substring(end));
        boolean isMeeting =
            time != null && MEETING_WORDS.matcher(sentenceAround(text, match.start())).find();
        hits.add(
            new Hit(
                match.start(),
                new Extraction(
                    isMeeting ? "meeting" : "date",
                    text.substring(match.start(), end + (time == null ? 0 : time.length())).strip(),
                    time == null ? day.toString() : day + "T" + time.value())));
      }
    }
    // In reading order; one chip per day, keeping the one with a time.
    hits.sort(Comparator.comparingInt(Hit::index));
    Map<String, Extraction> byDay = new LinkedHashMap<>();
    for (Hit hit : hits) {
      Extraction item = hit.item();
      String day = item.value().substring(0, 10);
      Extraction kept = byDay.get(day);
      if (kept == null || (!kept.value().contains("T") && item.value().contains("T"))) {
        byDay.put(day, item);
      }
    }
    return List.copyOf(byDay.values());
  }

  /** The day a date match names; null for an impossible date. */
  private static LocalDate resolveDay(Matcher match, LocalDate today) {
    String a = match.group(1) == null ? "" : match.group(1);
    String b = match.groupCount() >= 2 && match.group(2) != null ? match.group(2) : "";
    String c = match.groupCount() >= 3 ? match.group(3) : null;
    if (a.matches("\\d{4}")) {
      return makeDate(Integer.parseInt(a), Integer.parseInt(b) - 1, number(c));
    }
    String word = a.toLowerCase(Locale.ROOT);
    if (word.equals("today")) {
      return today;
    }
    if (word.equals("tomorrow")) {
      return today.plusDays(1);
    }
    int weekday = WEEKDAYS.indexOf(NEXT.matcher(word).replaceFirst(""));
    if (weekday >= 0) {
      // The next one after the send day: "Friday" sent on a Friday means a week on.
      int dow = today.getDayOfWeek().getValue() % 7;
      int ahead = (weekday - dow + 7) % 7;
      return today.plusDays(ahead == 0 ? 7 : ahead);
    }
    int monthFirst = MONTHS.indexOf(word.substring(0, Math.min(3, word.length())));
    String lowerB = b.toLowerCase(Locale.ROOT);
    int month =
        monthFirst >= 0
            ? monthFirst
            : MONTHS.indexOf(lowerB.substring(0, Math.min(3, lowerB.length())));
    int dayOfMonth = number(monthFirst >= 0 ? b : a);
    if (month < 0) {
      return null;
    }
    if (c != null && !c.isEmpty()) {
      return makeDate(Integer.parseInt(c), month, dayOfMonth);
    }
    // No year: the next time that day comes round.
    LocalDate thisYear = makeDate(today.getYear(), month, dayOfMonth);
    if (thisYear != null && thisYear.isBefore(today)) {
      return makeDate(today.getYear() + 1, month, dayOfMonth);
    }
    return thisYear;
  }

  private static int number(String digits) {
    return digits == null || digits.isEmpty() ? 0 : Integer.parseInt(digits);
  }

  /** {@code month} from 0; years 0 to 99 mean 1900 to 1999, as in JavaScript's Date. */
  private static LocalDate makeDate(int year, int month, int day) {
    try {
      return LocalDate.of(year >= 0 && year <= 99 ? 1900 + year : year, month + 1, day);
    } catch (DateTimeException e) {
      return null;
    }
  }

  /** "HH:mm" for a time just after a date, and how much text it took. */
  private static Time parseTime(String after) {
    Matcher match = TIME.matcher(after);
    if (!match.find()) {
      return null;
    }
    int hour = Integer.parseInt(match.group(1) != null ? match.group(1) : match.group(4));
    int minute = match.group(2) == null ? 0 : Integer.parseInt(match.group(2));
    String meridiem = match.group(3) != null ? match.group(3) : match.group(5);
    meridiem = meridiem == null ? "" : meridiem.toLowerCase(Locale.ROOT).replace(".", "");
    if (meridiem.equals("pm") && hour < 12) {
      hour += 12;
    }
    if (meridiem.equals("am") && hour == 12) {
      hour = 0;
    }
    if (hour > 23 || minute > 59) {
      return null;
    }
    return new Time(String.format(Locale.ROOT, "%02d:%02d", hour, minute), match.group().length());
  }

  private static String sentenceAround(String text, int index) {
    int start = Math.max(Math.max(text.lastIndexOf('\n', index), text.lastIndexOf(". ", index)), 0);
    Matcher rest = SENTENCE_END.matcher(text.substring(index));
    return rest.find() ? text.substring(start, index + rest.start()) : text.substring(start);
  }

  private static String listNames(List<String> names) {
    if (names.size() <= 1) {
      return names.isEmpty() ? "" : names.getFirst();
    }
    return String.join(", ", names.subList(0, names.size() - 1)) + " and " + names.getLast();
  }
}
