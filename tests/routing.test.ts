import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '@/core/routing/policy';
import { globsIntersect, launchCommand, route, staticPrefix } from '@/core/routing/routing';

const base = { role: 'backend', taskId: 'CU-86c1abcd', title: 'Tenant quota' };

describe('the score', () => {
  it('adds the three signals', () => {
    const decision = route({
      ...base,
      signals: { complexity: 'medium', risk: 'high', ambiguity: 'low' },
    });
    expect(decision.base).toBe(6);
    expect(decision.score).toBe(6);
    expect(decision.tier).toBe('T2-standard');
  });

  it('adds one for a large codebase and one for low test maturity', () => {
    const decision = route({
      ...base,
      signals: { complexity: 'medium', risk: 'medium', ambiguity: 'medium' },
      profile: { codebase_size: 'large', test_maturity: 'low' },
    });
    expect(decision.score).toBe(8);
    expect(decision.tier).toBe('T3-critical');
    expect(decision.modifiers.map((modifier) => modifier.key)).toEqual([
      'codebase_size_large',
      'test_maturity_low',
    ]);
  });

  it('adds one when the scope touches a critical path', () => {
    const decision = route({
      ...base,
      signals: { complexity: 'low', risk: 'low', ambiguity: 'low' },
      scope: { allow: ['app/billing/**'], deny: [] },
      profile: { critical_paths: ['app/billing/**'] },
    });
    expect(decision.score).toBe(4);
    expect(decision.modifiers).toHaveLength(1);
  });

  it('lets a role signal override the task signal', () => {
    const decision = route({
      ...base,
      role: 'frontend',
      signals: { complexity: 'medium', risk: 'high', ambiguity: 'low' },
      roleSignals: { complexity: 'low', risk: 'low' },
    });
    expect(decision.score).toBe(3);
    expect(decision.tier).toBe('T1-routine');
  });

  it('routes mechanical work to the mechanical tier whatever the score', () => {
    const decision = route({
      ...base,
      signals: { complexity: 'high', risk: 'high', ambiguity: 'high', kind: 'mechanical' },
    });
    expect(decision.tier).toBe(DEFAULT_POLICY.mechanical.name);
    expect(decision.phases.implement.model).toBe('haiku');
  });
});

describe('the launch command', () => {
  it('uses opusplan when plan is opus and implement is sonnet', () => {
    const command = launchCommand(
      {
        plan: { model: 'opus', effort: 'high' },
        implement: { model: 'sonnet', effort: 'high' },
        verify: { model: 'sonnet', effort: 'high' },
        ask: { model: 'sonnet', effort: 'low' },
      },
      'CU-86c1abcd',
      'Tenant quota',
    );
    expect(command).toBe(
      "claude --model opusplan --effort high --name 'CU-86c1abcd Tenant quota'",
    );
  });

  it('keeps an advisor that ranks at or above the main model', () => {
    const command = launchCommand(
      {
        plan: { model: 'opus', effort: 'xhigh' },
        implement: { model: 'opus', effort: 'high', advisor: 'opus' },
        verify: { model: 'opus', effort: 'xhigh' },
        ask: { model: 'opus', effort: 'low' },
      },
      'CU-1',
      'x',
    );
    expect(command).toContain('--advisor opus');
  });

  it('drops an advisor that ranks below the main model', () => {
    const command = launchCommand(
      {
        plan: { model: 'opus', effort: 'xhigh' },
        implement: { model: 'opus', effort: 'high', advisor: 'haiku' },
        verify: { model: 'opus', effort: 'high' },
        ask: { model: 'sonnet', effort: 'low' },
      },
      'CU-1',
      'x',
    );
    expect(command).not.toContain('--advisor');
  });

  it('quotes a title that contains a quote', () => {
    const command = launchCommand(
      {
        plan: { model: 'sonnet', effort: 'medium' },
        implement: { model: 'sonnet', effort: 'medium' },
        verify: { model: 'sonnet', effort: 'medium' },
        ask: { model: 'sonnet', effort: 'low' },
      },
      'CU-1',
      "it's a quota",
    );
    expect(command).toContain("'CU-1 it'\\''s a quota'");
  });
});

describe('glob intersection', () => {
  it('reads the static prefix', () => {
    expect(staticPrefix('app/quota/**')).toBe('app/quota/');
    expect(staticPrefix('app/quota/counter.py')).toBe('app/quota/counter.py');
    expect(staticPrefix('**/*.py')).toBe('');
  });

  it('intersects when one prefix contains the other', () => {
    expect(globsIntersect(['app/billing/**'], ['app/billing/invoice.py'])).toBe(true);
    expect(globsIntersect(['app/quota/**'], ['src/features/**'])).toBe(false);
  });

  it('is conservative when a prefix is empty', () => {
    expect(globsIntersect(['**/*.py'], ['anything/else/**'])).toBe(true);
  });
});
