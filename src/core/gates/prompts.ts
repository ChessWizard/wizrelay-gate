import type { GateId } from './gates';
/**
 * The languages a prompt is written in.
 *
 * Declared here rather than imported from the catalogue: core answers to nothing above
 * it, and what this file needs is the two words, not the panel's translation machinery.
 * `tests/i18n.test.ts` keeps the two lists from drifting apart.
 */
export type PromptLocale = 'en' | 'tr';

/**
 * What the panel says to Claude when it opens a gate, in the language the person uses.
 *
 * The console is read by whoever pressed the button. A session that thinks out loud in
 * English in front of somebody working in Turkish is not neutral — it is harder to
 * follow, slower to correct, and it quietly decides that the panel's two languages are
 * one language and a translation.
 *
 * The slash commands are not translated: `/wizrelay:plan` is the command's name, and the
 * skill behind it already answers in the language the hub declares. What is added is the
 * line that settles which language wins when the panel's and the hub's disagree — the
 * person reading the console is the one to answer.
 */
const ANSWER_IN: Record<PromptLocale, string> = {
  en: 'Answer in English, including your reasoning as you work.',
  tr: 'Türkçe yanıt ver; çalışırken düşündüklerini de Türkçe yaz.',
};

const PROSE: Partial<Record<GateId, Record<PromptLocale, string>>> = {
  research: {
    en: 'Draft the research package from the tracker task, with evidence from the code. Do not publish.',
    tr: 'Araştırma paketini tracker görevinden taslak olarak yaz; iddialarını koddan kanıtla. Yayınlama.',
  },
  implement: {
    en: 'Continue the plan. Stop and ask rather than assuming anything the package does not say.',
    tr: 'Planı sürdür. Paketin söylemediği bir şeyi varsaymak yerine durup sor.',
  },
};

const COMMAND: Partial<Record<GateId, string>> = {
  plan: '/wizrelay:plan',
  implement: '/wizrelay:implement',
  verify: '/wizrelay:verify',
  validate: '/wizrelay:hub-validate',
  intake: '/wizrelay:hub-new',
  publish: '/wizrelay:hub-publish',
};

/** The sentence that tells a session which language to work in. */
export function answerIn(locale: PromptLocale): string {
  return ANSWER_IN[locale] ?? ANSWER_IN.en;
}

/**
 * The prompt for one gate, or null when the panel has nothing to say about it.
 *
 * A command and its language line are two paragraphs, not one sentence: a slash command
 * has to be the first thing on the line for Claude Code to recognise it.
 */
export function gatePrompt(gate: GateId, locale: PromptLocale): string | null {
  const command = COMMAND[gate];
  if (command) return `${command}\n\n${answerIn(locale)}`;

  const prose = PROSE[gate];
  if (prose) return `${prose[locale] ?? prose.en}\n\n${answerIn(locale)}`;

  return null;
}

/** A note somebody typed, carried with the language the gate is working in. */
export function withNotes(prompt: string, notes: string | undefined): string {
  const trimmed = notes?.trim();
  return trimmed ? `${prompt}\n\n${trimmed}` : prompt;
}

/**
 * One file handed to a session with an instruction.
 *
 * The file is named in the sentence because a gate told to "add a verification command"
 * with no subject rewrites the whole package.
 */
export function editOneFile(path: string, instruction: string, locale: PromptLocale): string {
  const line =
    locale === 'tr'
      ? `Pakette yalnızca ${path} dosyasını düzenle, başka hiçbir dosyaya dokunma.`
      : `Edit ${path} in the package, and only that file.`;
  return `${line}\n\n${instruction}`;
}
