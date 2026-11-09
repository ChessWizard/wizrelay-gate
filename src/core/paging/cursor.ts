/**
 * Cutting a query's result into a page and the position after it.
 *
 * The query asks for one row more than the page holds. That extra row is never shown: it
 * is the answer to "is there more", which is otherwise a second query or a guess. The
 * off-by-one here is the whole of cursor paging and the only place it can go wrong, so
 * it lives in one function rather than in every screen that pages.
 */
export interface Page<T> {
  rows: T[];
  /** The id to continue from, or null when this is the last page. */
  nextCursor: string | null;
}

export function slicePage<T extends { id: string }>(fetched: T[], limit: number): Page<T> {
  if (limit <= 0) return { rows: [], nextCursor: null };

  const rows = fetched.slice(0, limit);
  const more = fetched.length > limit;

  return { rows, nextCursor: more ? (rows[rows.length - 1]?.id ?? null) : null };
}
