/**
 * Why a gate did not start, as something a person can read.
 *
 * `runGate` can refuse for two kinds of reason: a catalogue key the guard or the placement
 * already chose (`steps.noAgent`, `error.forbidden`), or a bare token from the engine
 * (`no-relay`). Both arrive in the same field, and a refusal that reaches the screen as
 * nothing at all is how a button comes to look broken.
 */
export function runReasonKey(reason?: string): string {
  if (!reason) return 'run.failed.unknown';
  return reason.includes('.') ? reason : `run.failed.${reason}`;
}
