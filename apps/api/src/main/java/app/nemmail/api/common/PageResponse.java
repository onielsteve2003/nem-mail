package app.nemmail.api.common;

import java.util.List;

/** One page of results (pageSchema in @nem/shared); {@code nextCursor} is null on the last page. */
public record PageResponse<T>(List<T> items, String nextCursor) {}
