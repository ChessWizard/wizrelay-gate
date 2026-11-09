/**
 * The one password rule.
 *
 * It was a server-side function nobody could see until they had already submitted: type
 * eleven characters, press the button, get told. The rule itself was fine; where it lived
 * was the problem, because a rule you only learn by failing is a rule the person has to
 * guess at twice.
 *
 * Pure, so the same list is both what the screen shows while somebody types and what the
 * server checks before it stores anything. They cannot drift: there is one array.
 */
export const PASSWORD_MIN = 12;

export interface PasswordCheck {
  /** The catalogue key for this requirement, shown as a line the person can tick off. */
  key: string;
  met: boolean;
}

const RULES: { key: string; test: (password: string) => boolean }[] = [
  { key: 'auth.rule.length', test: (password) => password.length >= PASSWORD_MIN },
  { key: 'auth.rule.letter', test: (password) => /[a-zA-Z]/.test(password) },
  { key: 'auth.rule.digit', test: (password) => /[0-9]/.test(password) },
];

/** Every requirement and whether this password meets it, in the order they are shown. */
export function passwordChecks(password: string): PasswordCheck[] {
  return RULES.map((rule) => ({ key: rule.key, met: rule.test(password) }));
}

export interface PasswordRule {
  ok: boolean;
  reasonKey?: string;
}

/** The first requirement this password fails, which is what a form reports. */
export function checkPassword(password: string): PasswordRule {
  const failed = passwordChecks(password).find((check) => !check.met);
  return failed ? { ok: false, reasonKey: failed.key } : { ok: true };
}
