import { describe, expect, it } from 'vitest';
import { planGate, runsUnattended, trackGates } from '@/core/gates/steps';
import type { StepContext } from '@/core/gates/steps';
import { GATE_IDS } from '@/core/gates/gates';

const context: StepContext = {
  relayId: 'CU-86c1abcd',
  title: 'Cache the price list',
  roles: ['api', 'web'],
  role: 'web',
  folder: 'CU-86c1abcd-cache-the-price-list',
  hubBranch: 'main',
  base: 'origin/develop',
};

describe('planning a gate', () => {
  it('fills the relay into the command instead of leaving a placeholder', () => {
    const [step] = planGate('pull', context);
    expect(step.command).toBe('wizrelay pull CU-86c1abcd');
    expect(step.command).not.toContain('<');
  });

  it('quotes an argument that needs it, and leaves plain ones alone', () => {
    const step = planGate('intake', context).find((candidate) =>
      candidate.command.startsWith('wizrelay hub new'),
    );
    expect(step?.command).toContain('--title "Cache the price list"');
    expect(step?.command).toContain('--roles api,web');
  });

  it('opens the task branch before anything is written into it', () => {
    // Order is the whole point: `hub new` writes the package, and it has to land on the
    // task's branch rather than on whatever the hub checkout happened to be on.
    const steps = planGate('intake', context);
    expect(steps[0].command).toBe('git checkout -B research/CU-86c1abcd-cache-the-price-list');
    expect(steps[1].command).toContain('wizrelay hub new');
  });

  it('publishes to the task branch, never straight to the hub branch', () => {
    const push = planGate('publish', context).find((step) => step.command.startsWith('git push'));
    expect(push?.command).toBe('git push -u origin research/CU-86c1abcd-cache-the-price-list');
    expect(push?.approval).toBe('push');
  });

  it('puts the package on the hub branch only at delivery, and asks first', () => {
    const release = planGate('ship', context).find((step) => step.where === 'hub');
    expect(release?.command).toBe(
      'git push origin research/CU-86c1abcd-cache-the-price-list:main',
    );
    expect(release?.approval).toBe('push');
  });

  it('runs each gate in the checkout that gate belongs to', () => {
    expect(planGate('validate', context).every((step) => step.where === 'hub')).toBe(true);
    expect(planGate('pull', context).every((step) => step.where === 'repo')).toBe(true);
    // Ship is the one gate that touches both: the repository it built in, and the hub it
    // releases the package to.
    expect(new Set(planGate('ship', context).map((step) => step.where))).toEqual(
      new Set(['repo', 'hub']),
    );
  });

  it('asks before anything leaves the machine', () => {
    const push = planGate('ship', context).find((step) => step.command.startsWith('git push'));
    expect(push?.approval).toBe('push');
    const commit = planGate('publish', context).find((step) => step.command.startsWith('git commit'));
    expect(commit?.approval).toBe('commit');
  });

  it('never asks before a command that only reads', () => {
    for (const gate of GATE_IDS) {
      for (const step of planGate(gate, context)) {
        if (step.readOnly) expect(step.approval, `${gate} ${step.id}`).toBeNull();
      }
    }
  });

  it('marks the values nobody has supplied yet', () => {
    const prep = planGate('publish', context)[0];
    expect(prep.needs).toBe('summary');
    const supplied = planGate('publish', { ...context, summary: 'adds the release tag' })[0];
    expect(supplied.needs).toBeUndefined();
    expect(supplied.command).toContain('"adds the release tag"');
  });

  it('plans a conversation for the gates that are one', () => {
    expect(planGate('research', context)[0].kind).toBe('conversation');
    expect(planGate('implement', context).some((step) => step.kind === 'conversation')).toBe(true);
  });

  it('gives every step a unique id within its gate', () => {
    for (const gate of GATE_IDS) {
      const ids = planGate(gate, context).map((step) => step.id);
      expect(new Set(ids).size, gate).toBe(ids.length);
    }
  });

  it('only ever plans wizrelay or git', () => {
    for (const gate of GATE_IDS) {
      for (const step of planGate(gate, context)) {
        if (step.kind === 'command') expect(['wizrelay', 'git']).toContain(step.binary);
      }
    }
  });

  it('uses the repository’s own base ref when it has one', () => {
    const audit = planGate('ship', context).find((step) => step.command.includes('--base'));
    expect(audit?.command).toContain('--base origin/develop');
  });
});

describe('a track', () => {
  it('walks its gates in pipeline order', () => {
    expect(trackGates('research')).toEqual(['intake', 'research', 'validate', 'publish']);
    expect(trackGates('delivery')).toEqual(['pull', 'plan', 'implement', 'verify', 'ship']);
  });

  it('knows which gates can run without stopping to ask', () => {
    expect(runsUnattended(planGate('validate', context))).toBe(true);
    expect(runsUnattended(planGate('pull', context))).toBe(true);
    expect(runsUnattended(planGate('ship', context))).toBe(false);
    expect(runsUnattended(planGate('publish', context))).toBe(false);
  });
});

/**
 * Flags the CLI actually accepts.
 *
 * `wizrelay hub validate` takes `--strict` and `--no-fail` and nothing else; a `--format`
 * copied from `wizrelay audit` made the step exit 2 on an argparse error, which the gate
 * then read as the package being invalid. A step that fails for its own reasons says
 * nothing about the work it was meant to judge.
 */
describe('the arguments a step passes', () => {
  const VALIDATE_FLAGS = ['--strict', '--no-fail'];

  it('gives hub validate only the flags it has', () => {
    for (const gate of ['research', 'validate'] as const) {
      for (const step of planGate(gate, context)) {
        if (!step.command.startsWith('wizrelay hub validate')) continue;
        const flags = (step.args ?? []).filter((arg) => arg.startsWith('--'));
        for (const flag of flags) {
          expect(VALIDATE_FLAGS, `${gate}: ${step.command}`).toContain(flag);
        }
      }
    }
  });

  it('lets the research check decide the gate, so it may not suppress its own failure', () => {
    const check = planGate('research', context).find((step) =>
      step.command.startsWith('wizrelay hub validate'),
    );
    expect(check).toBeDefined();
    expect(check?.args ?? []).not.toContain('--no-fail');
  });
});

/**
 * Two checks that look like one.
 *
 * Research ends by checking its own output: a gate may not report success without
 * producing what it claims. Validate asks a different question at a different moment —
 * whether what is about to be published is sound — and the package can change in between,
 * because the panel can edit it. What they must not be is the same command twice, which
 * is what they were: validate ran the structural check a second time, with `--no-fail`,
 * so the gate whose job is validation could not fail.
 */
describe('research and validate do different work', () => {
  it('lets research prove it wrote the package', () => {
    const check = planGate('research', context).find((step) =>
      step.command.startsWith('wizrelay hub validate'),
    );
    expect(check?.args ?? []).not.toContain('--no-fail');
  });

  it('makes validate a review rather than the same command again', () => {
    const steps = planGate('validate', context);
    expect(steps.every((step) => step.kind === 'conversation')).toBe(true);
    expect(steps.some((step) => step.command.startsWith('wizrelay hub validate'))).toBe(false);
  });

  it('keeps both in the hub, which is where the package is', () => {
    for (const gate of ['research', 'validate'] as const) {
      expect(planGate(gate, context).every((step) => step.where === 'hub')).toBe(true);
    }
  });
});
