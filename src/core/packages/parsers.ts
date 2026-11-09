/**
 * Parsers for the package's text formats (§6.6 of the plugin's plan). The grammars are
 * the plugin's, and the keywords are bilingual because a hub may be written in Turkish:
 *
 *   AC heading   `## AC-<n> [role1, role2] Title`
 *   Decision     `## D-<nnn> Title (v<N>, YYYY-MM-DD)`
 *   Question     `## Q-<nnn> Title` + a status line
 *   Plan step    `- [ ]` / `- [x]`
 *
 * Content inside a code fence or a blockquote does not count, exactly as the plugin
 * requires — a format example in the documentation is not a criterion.
 */
import type {
  AcceptanceCriterion,
  Decision,
  PlanStep,
  Question,
} from '@/core/relay/types';
import type { CriterionResult, Verdict } from '@/core/status/status';
import { fold } from '@/core/text/fold';
import { normaliseHandle, parseMentions } from './mentions';

/** Re-exported so the parsers stay the one import for package-text helpers. */
export { fold };

const VERIFICATION_KEYS = ['verification:', 'doğrulama:', 'dogrulama:'];
const STATUS_KEYS = ['status:', 'durum:'];
const OPEN_WORDS = ['open', 'açik', 'açık', 'acik'];
const ANSWERED_WORDS = ['answered', 'yanitlandi', 'yanıtlandı', 'yanitlandı'];
const CANCELLED_WORDS = ['cancelled', 'canceled', 'iptal'];
const ASKED_KEYS = ['asked:', 'soruldu:'];
const CONTEXT_KEYS = ['context:', 'bağlam:', 'baglam:'];
const ASKED_BY_KEYS = ['asked by:', 'soran:'];
const ASK_KEYS = ['ask:', 'to:', 'kime:', 'muhatap:'];

/** Lines outside code fences and blockquotes, with their 1-based numbers. */
export function significantLines(text: string): { line: string; number: number }[] {
  const out: { line: string; number: number }[] = [];
  let inFence = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (line.trimStart().startsWith('>')) return;
    out.push({ line, number: index + 1 });
  });
  return out;
}

function valueAfter(line: string, keys: string[]): string | null {
  const folded = fold(line);
  for (const key of keys) {
    const at = folded.indexOf(key);
    if (at !== -1) return line.slice(at + key.length).trim();
  }
  return null;
}

export function parseAcceptance(text: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  let current: AcceptanceCriterion | null = null;

  for (const { line } of significantLines(text)) {
    const heading = /^#{2,3}\s+(AC-\d+)\s*(?:\[([^\]]*)\])?\s*(.*)$/i.exec(line.trim());
    if (heading) {
      if (current) criteria.push(current);
      current = {
        id: heading[1].toUpperCase(),
        roles: (heading[2] ?? '')
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean),
        title: heading[3].trim(),
      };
      continue;
    }
    if (!current) continue;

    const verification = valueAfter(line, VERIFICATION_KEYS);
    if (verification !== null) {
      current.verification = verification.replace(/^`+|`+$/g, '').trim();
      continue;
    }
    const trimmed = line.trim();
    if (/^given\b/i.test(trimmed)) current.given = trimmed.replace(/^given\s*/i, '');
    else if (/^when\b/i.test(trimmed)) current.when = trimmed.replace(/^when\s*/i, '');
    else if (/^then\b/i.test(trimmed)) current.then = trimmed.replace(/^then\s*/i, '');
  }
  if (current) criteria.push(current);
  return criteria;
}

export function parseDecisions(text: string): Decision[] {
  const decisions: Decision[] = [];
  let current: Decision | null = null;

  for (const { line } of significantLines(text)) {
    const heading = /^#{2,3}\s+(D-\d+)\s+(.*?)\s*\(v(\d+),\s*([\d-]+)\)\s*$/i.exec(line.trim());
    if (heading) {
      if (current) decisions.push(current);
      current = {
        id: heading[1].toUpperCase(),
        title: heading[2].trim(),
        version: Number(heading[3]),
        date: heading[4],
      };
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();

    const labelled = /^(?:[-*+]\s+)?\*{0,2}(Question|Decision|Rationale|Impact|Soru|Karar|Gerekçe|Gerekce|Etki)\*{0,2}\s*[:·-]\s*(.*)$/i.exec(
      trimmed,
    );
    if (!labelled) continue;
    const key = fold(labelled[1]);
    const value = labelled[2].trim();
    if (key === 'question' || key === 'soru') current.question = value;
    else if (key === 'decision' || key === 'karar') current.decision = value;
    else if (key === 'rationale' || key === 'gerekçe' || key === 'gerekce') current.rationale = value;
    else current.impact = value;
  }
  if (current) decisions.push(current);
  return decisions;
}

export function parseQuestions(text: string, relayId: string, role?: string): Question[] {
  const questions: Question[] = [];
  let current: Question | null = null;
  const body: string[] = [];

  const flush = () => {
    if (!current) return;
    current.body = body.join('\n').trim() || undefined;

    const mentioned = parseMentions(`${current.title}\n${current.body ?? ''}`);
    const asked = [...(current.askedOf ?? []), ...mentioned];
    current.askedOf = asked.length > 0 ? [...new Set(asked)] : undefined;

    questions.push(current);
    body.length = 0;
  };

  for (const { line } of significantLines(text)) {
    const heading = /^#{2,3}\s+(Q-\d+)\s+(.*)$/i.exec(line.trim());
    if (heading) {
      flush();
      current = {
        id: heading[1].toUpperCase(),
        title: heading[2].trim(),
        status: 'OPEN',
        askedAt: '',
        relayId,
        role,
      };
      continue;
    }
    if (!current) continue;

    const status = valueAfter(line, STATUS_KEYS);
    if (status !== null) {
      const folded = fold(status);
      if (ANSWERED_WORDS.some((word) => folded.startsWith(word))) {
        current.status = 'ANSWERED';
        const decision = /\b(D-\d+)\b/i.exec(status);
        if (decision) current.decisionId = decision[1].toUpperCase();
      } else if (CANCELLED_WORDS.some((word) => folded.startsWith(word))) {
        current.status = 'CANCELLED';
      } else if (OPEN_WORDS.some((word) => folded.startsWith(word))) {
        current.status = 'OPEN';
      }
      continue;
    }
    const asked = valueAfter(line, ASKED_KEYS);
    if (asked !== null) {
      current.askedAt = asked;
      continue;
    }
    const context = valueAfter(line, CONTEXT_KEYS);
    if (context !== null) {
      current.blocks = context;
      continue;
    }
    const asker = valueAfter(line, ASKED_BY_KEYS);
    if (asker !== null) {
      current.askedBy = normaliseHandle(asker) || undefined;
      continue;
    }
    const addressed = valueAfter(line, ASK_KEYS);
    if (addressed !== null) {
      const handles = addressed
        .split(/[,;]+/)
        .map((part) => normaliseHandle(part))
        .filter(Boolean);
      current.askedOf = handles.length > 0 ? handles : undefined;
      continue;
    }
    body.push(line);
  }
  flush();
  return questions;
}

export function parsePlan(text: string): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const { line } of significantLines(text)) {
    const step = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (!step) continue;
    const body = step[2].trim();
    const criterion = /\b(AC-\d+)\b/i.exec(body);
    steps.push({
      index: steps.length + 1,
      done: step[1].toLowerCase() === 'x',
      text: body,
      criterion: criterion ? criterion[1].toUpperCase() : undefined,
    });
  }
  return steps;
}

export function planProgress(steps: PlanStep[]): { done: number; total: number } {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/** `{{placeholder}}` markers block publication; counting them is how a draft is judged. */
export function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

export function resultOf(line: string): CriterionResult | null {
  const folded = fold(line);
  if (folded.includes('not covered') || folded.includes('kapsanmadi')) return 'NOT COVERED';
  if (folded.includes('fail') || folded.includes('kaldi')) return 'FAIL';
  if (folded.includes('pass') || folded.includes('gecti')) return 'PASS';
  return null;
}

/**
 * A gate's overall verdict, which has one value a criterion does not: `PARTIAL`. It is
 * read before the criterion results, because "partial" must not be mistaken for a pass.
 */
export function verdictOf(line: string): Verdict | null {
  const folded = fold(line);
  if (folded.includes('partial') || folded.includes('kismi')) return 'PARTIAL';
  if (folded.includes('fail') || folded.includes('kaldi')) return 'FAIL';
  if (folded.includes('pass') || folded.includes('gecti')) return 'PASS';
  return null;
}

/**
 * `verification.md`, as `/wizrelay:verify` writes it.
 *
 * The grammar is the plugin's template (`templates/dev/<lang>/verification.md`): a header
 * line naming the verifier, a result line, a table of `| AC-n | evidence | result |`, and
 * two prose sections. Both language templates are accepted, because a hub may be written
 * in Turkish and the developer's repository follows the hub.
 */
export interface VerificationReport {
  agent?: string;
  verdict?: Verdict;
  results: { id: string; evidence?: string; result?: CriterionResult }[];
  notVerified?: string;
  auditText?: string;
}

const AGENT_KEYS = ['verified by:', 'doğrulayan:', 'dogrulayan:'];
const RESULT_KEYS = ['result:', 'sonuç:', 'sonuc:'];
const NOT_VERIFIED_HEADINGS = ['not verified', 'doğrulanamayanlar', 'dogrulanamayanlar'];
const AUDIT_HEADINGS = ['scope audit', 'kapsam denetimi'];

/** `AC-1` plus whatever the row says, with the backticks the template puts round a command. */
function tableRow(line: string): { id: string; evidence?: string; result?: CriterionResult } | null {
  if (!line.startsWith('|')) return null;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length < 2) return null;

  const id = /^(AC-\d+)$/i.exec(cells[0])?.[1];
  if (!id) return null;

  const evidence = cells[1]?.replace(/^`|`$/g, '').trim() || undefined;
  const result = cells[2] ? resultOf(cells[2]) : null;
  return { id: id.toUpperCase(), evidence, result: result ?? undefined };
}

export function parseVerification(text: string): VerificationReport {
  const report: VerificationReport = { results: [] };
  const notVerified: string[] = [];
  const audit: string[] = [];
  let section: 'none' | 'notVerified' | 'audit' = 'none';

  for (const { line } of significantLines(text)) {
    const trimmed = line.trim();

    const heading = /^#{2,3}\s+(.*)$/.exec(trimmed);
    if (heading) {
      const name = fold(heading[1]);
      if (NOT_VERIFIED_HEADINGS.some((candidate) => name.startsWith(fold(candidate)))) {
        section = 'notVerified';
      } else if (AUDIT_HEADINGS.some((candidate) => name.startsWith(fold(candidate)))) {
        section = 'audit';
      } else {
        section = 'none';
      }
      continue;
    }

    const agent = valueAfter(trimmed, AGENT_KEYS);
    if (agent !== null && !report.agent) {
      report.agent = agent;
      continue;
    }

    const result = valueAfter(trimmed, RESULT_KEYS);
    if (result !== null && !report.verdict) {
      const verdict = verdictOf(result);
      if (verdict) report.verdict = verdict;
      continue;
    }

    const row = tableRow(trimmed);
    if (row) {
      report.results.push(row);
      continue;
    }

    if (section === 'notVerified' && trimmed) notVerified.push(trimmed);
    else if (section === 'audit' && trimmed) audit.push(trimmed);
  }

  report.notVerified = notVerified.join('\n').trim() || undefined;
  report.auditText = audit.join('\n').trim() || undefined;
  return report;
}
