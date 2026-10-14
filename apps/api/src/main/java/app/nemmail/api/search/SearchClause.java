package app.nemmail.api.search;

/**
 * One piece of a search query (SearchClause in @nem/shared). {@code phrase} only matters for text;
 * {@code negated} comes from a leading {@code -}. Dates are YYYY-MM-DD.
 */
record SearchClause(Kind kind, String value, boolean phrase, boolean negated) {

  enum Kind {
    TEXT,
    FROM,
    TO,
    SUBJECT,
    LABEL,
    HAS,
    IS,
    BEFORE,
    AFTER
  }
}
