import { describe, expect, it } from 'vitest';
import { parseDecisions, parseVerification, verdictOf } from '@/core/packages/parsers';

/**
 * The grammar is the plugin's own template (`templates/dev/<lang>/verification.md`), so
 * the fixtures here are that template filled in — both languages, because a hub may be
 * written in Turkish and the developer's repository follows the hub.
 */
const ENGLISH = `# Verification — CU-86c1abcd

Owner: developer, written by \`/wizrelay:verify\`. Verified by: wizrelay:test-engineer

Result: PARTIAL

## Acceptance criteria

| AC | Evidence (command) | Result |
|---|---|---|
| AC-1 | \`pytest -q tests/quota\` | PASS |
| AC-2 | \`pytest -q tests/limits\` | PASS |
| AC-3 | — | NOT COVERED |
| AC-4 | \`pytest -q tests/billing\` | FAIL |

## Scope audit

3 files in scope, 0 out of scope.

## Not verified

AC-3 has no test in the repository proving idempotent charging.
`;

const TURKISH = `# Doğrulama — CU-9a0c62b7

Sahip: developer, \`/wizrelay:verify\` yazar. Doğrulayan: wizrelay:test-engineer

Sonuç: GEÇTİ

## Kabul kriterleri

| AC | Kanıt (komut) | Sonuç |
|---|---|---|
| AC-1 | \`pytest -q\` | GEÇTİ |

## Doğrulanamayanlar

Yok.
`;

describe('parsing verification.md', () => {
  const report = parseVerification(ENGLISH);

  it('reads the verifier', () => {
    expect(report.agent).toBe('wizrelay:test-engineer');
  });

  it('reads a PARTIAL result, which is not a criterion result', () => {
    expect(report.verdict).toBe('PARTIAL');
  });

  it('reads one row per criterion, with its evidence unbackticked', () => {
    expect(report.results).toHaveLength(4);
    expect(report.results[0]).toEqual({
      id: 'AC-1',
      evidence: 'pytest -q tests/quota',
      result: 'PASS',
    });
  });

  it('keeps NOT COVERED distinct from FAIL', () => {
    expect(report.results.find((row) => row.id === 'AC-3')?.result).toBe('NOT COVERED');
    expect(report.results.find((row) => row.id === 'AC-4')?.result).toBe('FAIL');
  });

  it('keeps the two prose sections apart', () => {
    expect(report.notVerified).toContain('idempotent charging');
    expect(report.auditText).toContain('out of scope');
    expect(report.notVerified).not.toContain('out of scope');
  });

  it('reads the Turkish template too', () => {
    const turkish = parseVerification(TURKISH);
    expect(turkish.verdict).toBe('PASS');
    expect(turkish.agent).toBe('wizrelay:test-engineer');
    expect(turkish.results[0].result).toBe('PASS');
  });

  it('returns an empty report rather than throwing on an empty file', () => {
    expect(parseVerification('').results).toEqual([]);
    expect(parseVerification('').verdict).toBeUndefined();
  });

  it('ignores a table row that is not a criterion', () => {
    const noise = parseVerification('| Note | something | PASS |\n| AC-9 | `x` | PASS |');
    expect(noise.results.map((row) => row.id)).toEqual(['AC-9']);
  });
});

describe('reading a verdict', () => {
  it('tells PARTIAL apart from PASS and FAIL', () => {
    expect(verdictOf('PARTIAL')).toBe('PARTIAL');
    expect(verdictOf('Result: PASS')).toBe('PASS');
    expect(verdictOf('FAIL')).toBe('FAIL');
    expect(verdictOf('kısmi')).toBe('PARTIAL');
    expect(verdictOf('nothing here')).toBeNull();
  });
});

describe('decisions written as a bullet list', () => {
  /** How a real hub writes them, which the earlier regex silently skipped. */
  const text = `# Kararlar

## D-018 Ayrıntılı kayıt açılmaz (v1, 2026-11-03)

- Soru: Handler'lardaki notlar ayrıntılı kayda mı işaret ediyor?
- Karar: Ayrıntılı kayıt bu task'ta açılmaz.
- Gerekçe: Researcher'ın kararı.
- Etki: AC-24
`;

  it('reads the labelled lines through the list marker', () => {
    const [decision] = parseDecisions(text);
    expect(decision.id).toBe('D-018');
    expect(decision.version).toBe(1);
    expect(decision.question).toContain('ayrıntılı kayda');
    expect(decision.decision).toBe("Ayrıntılı kayıt bu task'ta açılmaz.");
    expect(decision.rationale).toContain('Researcher');
    expect(decision.impact).toBe('AC-24');
  });

  it('still reads them without a list marker', () => {
    const plain = parseDecisions('## D-1 Title (v2, 2026-01-01)\n\nDecision: do the thing\n');
    expect(plain[0].decision).toBe('do the thing');
    expect(plain[0].version).toBe(2);
  });
});
