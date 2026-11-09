import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASK_ACTIVITY } from '@/services/panel/activity';

const SRC = join(process.cwd(), 'src');

function read(path: string): string {
  return readFileSync(join(SRC, path), 'utf8');
}

/**
 * The activity log is what people did to tasks.
 *
 * It used to hold sign-ins, hubs connected and members given a role, and the one thing
 * anybody opens it for — who ran that gate and what did it say — scrolled past between
 * them. The list below is the whole definition, and these keep the code honest about it:
 * a kind nobody records should not be readable, and nothing outside the list should be
 * written anywhere.
 */
describe('what the activity log holds', () => {
  it('is the task kinds and nothing else', () => {
    expect([...TASK_ACTIVITY].sort()).toEqual([
      'GATE_RUN',
      'PACKAGE_PUBLISHED',
      'PROMPT_ANSWERED',
      'QUESTION_ANSWERED',
      'QUESTION_ASKED',
    ]);
  });

  it('writes no administrative row anywhere', () => {
    const administrative = [
      'SIGNED_IN',
      'HUB_ADDED',
      'HUB_REMOVED',
      'PROJECT_ADDED',
      'PROJECT_REMOVED',
      'MEMBER_ADDED',
      'MEMBER_REMOVED',
      'MEMBER_ROLE_CHANGED',
    ];
    const writers = ['features/admin/actions.ts', 'features/auth/actions.ts'];

    for (const file of writers) {
      const source = read(file);
      for (const kind of administrative) {
        expect(source.includes(`'${kind}'`), `${file} still records ${kind}`).toBe(false);
      }
    }
  });

  it('records a gate run where the verdict is known, not where the button was pressed', () => {
    const runner = read('services/engine/runner.ts');
    expect(runner).toContain("kind: 'GATE_RUN'");
    expect(read('features/gate-prompts/actions.ts')).not.toContain("kind: 'GATE_RUN'");
  });
});
