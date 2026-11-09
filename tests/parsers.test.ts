import { describe, expect, it } from 'vitest';
import {
  countPlaceholders,
  fold,
  parseAcceptance,
  parseDecisions,
  parsePlan,
  parseQuestions,
  planProgress,
  significantLines,
} from '@/core/packages/parsers';

describe('acceptance criteria', () => {
  const text = `## AC-1 [backend, frontend] Requests over the limit return 429

Given a tenant that has used its daily quota
When another request arrives
Then the API answers 429
Verification: pytest tests/quota/test_quota_exceeded.py

### AC-2 Counter is atomic
Then it is atomic
Doğrulama: pytest tests/quota/test_concurrency.py
`;

  it('reads the id, the roles and the title', () => {
    const [first] = parseAcceptance(text);
    expect(first.id).toBe('AC-1');
    expect(first.roles).toEqual(['backend', 'frontend']);
    expect(first.title).toBe('Requests over the limit return 429');
  });

  it('reads given / when / then and the verification line', () => {
    const [first] = parseAcceptance(text);
    expect(first.given).toContain('daily quota');
    expect(first.verification).toBe('pytest tests/quota/test_quota_exceeded.py');
  });

  it('accepts a three-hash heading and a Turkish verification line', () => {
    const criteria = parseAcceptance(text);
    expect(criteria).toHaveLength(2);
    expect(criteria[1].verification).toBe('pytest tests/quota/test_concurrency.py');
    expect(criteria[1].roles).toEqual([]);
  });

  it('ignores a criterion inside a code fence', () => {
    const fenced = ['```markdown', '## AC-9 Not real', '```', '## AC-1 Real'].join('\n');
    expect(parseAcceptance(fenced).map((item) => item.id)).toEqual(['AC-1']);
  });

  it('ignores a criterion inside a blockquote', () => {
    expect(parseAcceptance('> ## AC-9 Quoted\n## AC-1 Real')).toHaveLength(1);
  });
});

describe('decisions', () => {
  it('reads the identifier, version and date', () => {
    const [decision] = parseDecisions(
      `## D-004 Retry-After is capped (v2, 2026-10-30)

Question: seconds or a date?
Decision: Seconds, capped at 3600.
Rationale: Clients retry blindly.
Impact: AC-1 keeps seconds.`,
    );
    expect(decision.id).toBe('D-004');
    expect(decision.version).toBe(2);
    expect(decision.date).toBe('2026-10-30');
    expect(decision.decision).toBe('Seconds, capped at 3600.');
  });

  it('reads Turkish labels', () => {
    const [decision] = parseDecisions(
      `## D-001 Kota penceresi (v1, 2026-10-29)

Soru: 24 saat mi takvim günü mü?
Karar: UTC takvim günü.`,
    );
    expect(decision.question).toContain('24 saat');
    expect(decision.decision).toBe('UTC takvim günü.');
  });
});

describe('questions', () => {
  it('reads an open question', () => {
    const [question] = parseQuestions(
      `## Q-001 Is Retry-After seconds or a date?

Status: OPEN
Asked: 2026-10-30
Context: AC-1

Both readings are defensible.`,
      'CU-86c1abcd',
      'backend',
    );
    expect(question.status).toBe('OPEN');
    expect(question.askedAt).toBe('2026-10-30');
    expect(question.blocks).toBe('AC-1');
    expect(question.body).toContain('defensible');
  });

  it('reads a Turkish answered question and its decision', () => {
    const [question] = parseQuestions(
      `## Q-002 Retry-After saniye mi?

Durum: YANITLANDI (D-004)
Soruldu: 2026-10-30`,
      'CU-1',
    );
    expect(question.status).toBe('ANSWERED');
    expect(question.decisionId).toBe('D-004');
  });

  it('reads a cancelled question', () => {
    const [question] = parseQuestions('## Q-003 Gone\n\nStatus: CANCELLED', 'CU-1');
    expect(question.status).toBe('CANCELLED');
  });
});

describe('the plan', () => {
  const plan = `# Plan

- [x] 1. Add the quota field (AC-4)
- [X] 2. Count atomically (AC-2)
* [ ] 3. Idempotency (AC-3)
`;

  it('counts checked steps', () => {
    const steps = parsePlan(plan);
    expect(steps).toHaveLength(3);
    expect(planProgress(steps)).toEqual({ done: 2, total: 3 });
  });

  it('links a step to its criterion', () => {
    expect(parsePlan(plan)[2].criterion).toBe('AC-3');
  });
});

describe('helpers', () => {
  it('folds Turkish dotted and dotless I', () => {
    expect(fold('AÇIK')).toBe(fold('açık'));
    expect(fold('İPTAL')).toBe('iptal');
  });

  it('folds the rest of the Turkish diacritics, so a template and a keyword list meet', () => {
    expect(fold('GEÇTİ')).toBe('gecti');
    expect(fold('KALDI')).toBe('kaldi');
    expect(fold('Doğrulama')).toBe('dogrulama');
    expect(fold('Şöyle')).toBe('soyle');
    expect(fold('ÜÇÜNCÜ')).toBe('ucuncu');
  });

  it('leaves text that needs no folding alone', () => {
    expect(fold('AC-12')).toBe('ac-12');
    expect(fold('  pytest -q  ')).toBe('pytest -q');
  });

  it('counts placeholders', () => {
    expect(countPlaceholders('a {{one}} and {{two}}')).toBe(2);
  });

  it('numbers the lines it keeps', () => {
    const lines = significantLines('a\n```\nb\n```\nc');
    expect(lines.map((line) => line.line)).toEqual(['a', 'c']);
    expect(lines.map((line) => line.number)).toEqual([1, 5]);
  });
});
