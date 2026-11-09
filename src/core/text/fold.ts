/**
 * Fold Turkish text for loose comparison.
 *
 * Two things happen here, and both are needed. The dotted/dotless I first: `toLowerCase()`
 * turns `I` into `i` but leaves `İ` as `i` plus a combining dot, which then matches
 * nothing — so `AÇIK` and `açık` would compare unequal. Then the remaining diacritics,
 * because the text this app reads is written by people and by templates that disagree
 * about them: a verification file says `GEÇTİ`, a keyword list says `gecti`, and a person
 * searching types `acik`. All three must meet.
 *
 * This is for comparison only. Nothing folded is ever shown to anyone.
 */
const FOLDED: Record<string, string> = {
  İ: 'i',
  I: 'i',
  ı: 'i',
  Ç: 'c',
  ç: 'c',
  Ğ: 'g',
  ğ: 'g',
  Ö: 'o',
  ö: 'o',
  Ş: 's',
  ş: 's',
  Ü: 'u',
  ü: 'u',
};

export function fold(value: string): string {
  let out = '';
  for (const character of value) out += FOLDED[character] ?? character;
  return out.toLowerCase().trim();
}
