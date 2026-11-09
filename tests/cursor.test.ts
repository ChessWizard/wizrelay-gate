import { describe, expect, it } from 'vitest';
import { slicePage } from '@/core/paging/cursor';

/**
 * The off-by-one that cursor paging is made of.
 *
 * A page that returns its own last row as the cursor and then skips one is correct; a
 * page that returns the peeked row's id loses a row at every boundary, and a page that
 * offers a cursor when there is nothing more leaves a button that does nothing.
 */
const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index}` }));

describe('cutting a result into a page', () => {
  it('returns the page and the id to continue from', () => {
    // Asked for 3, fetched 4: the fourth only answers "there is more".
    const page = slicePage(rows(4), 3);
    expect(page.rows.map((row) => row.id)).toEqual(['r0', 'r1', 'r2']);
    expect(page.nextCursor).toBe('r2');
  });

  it('offers no cursor when the result fits exactly', () => {
    const page = slicePage(rows(3), 3);
    expect(page.rows).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('offers no cursor for a short page', () => {
    expect(slicePage(rows(1), 3).nextCursor).toBeNull();
  });

  it('handles an empty result without inventing a position', () => {
    expect(slicePage(rows(0), 3)).toEqual({ rows: [], nextCursor: null });
  });

  it('never shows the row it only peeked at', () => {
    const page = slicePage(rows(10), 4);
    expect(page.rows).toHaveLength(4);
    expect(page.rows.map((row) => row.id)).not.toContain('r4');
  });

  it('refuses a limit that is not a page', () => {
    expect(slicePage(rows(5), 0)).toEqual({ rows: [], nextCursor: null });
    expect(slicePage(rows(5), -1)).toEqual({ rows: [], nextCursor: null });
  });
});
