import type { GateId } from '@/core/gates/gates';
import type { GateStatus, Verdict } from '@/core/status/status';
import type { Check, GatePrompt, GateState, Question, Relay, Track } from '@/core/relay/types';

/** Minutes/hours/days before a fixed point, so the sample data always reads as recent. */
const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

type CheckSpec = [GateStatus | 'pass' | 'fail' | 'skip', string, string?, string?, string?];

function check(index: number, [status, message, loc, command, output]: CheckSpec): Check {
  const normalised: Check['status'] =
    status === 'pass' || status === 'passed'
      ? 'pass'
      : status === 'fail' || status === 'failed'
        ? 'fail'
        : 'skip';
  return {
    id: `C${index + 1}`,
    status: normalised,
    message,
    loc: loc || undefined,
    command: command || undefined,
    output: output || undefined,
  };
}

interface GateSpec {
  gate: GateId;
  status: GateStatus;
  durationMs?: number;
  result?: string;
  verdict?: Verdict;
  checks?: CheckSpec[];
  artifacts?: { path: string; summary?: string; owner?: 'researcher' | 'developer' }[];
  metrics?: Record<string, string | number>;
  commands?: { command: string; exitCode?: number }[];
  prompts?: GatePrompt[];
  guardEvents?: GateState['guardEvents'];
  findings?: GateState['findings'];
  startedMinutesAgo?: number;
}

function gate(spec: GateSpec): GateState {
  const started = spec.startedMinutesAgo !== undefined ? ago(spec.startedMinutesAgo) : undefined;
  return {
    gate: spec.gate,
    status: spec.status,
    startedAt: started,
    finishedAt:
      started && spec.durationMs !== undefined && spec.status !== 'running' && spec.status !== 'waiting'
        ? new Date(new Date(started).getTime() + spec.durationMs).toISOString()
        : undefined,
    durationMs: spec.durationMs,
    result: spec.result,
    verdict: spec.verdict,
    checks: (spec.checks ?? []).map((item, index) => check(index, item)),
    findings: spec.findings,
    prompts: spec.prompts ?? [],
    artifacts: (spec.artifacts ?? []).map((artifact) => ({
      path: artifact.path,
      kind: 'file' as const,
      owner: artifact.owner,
      summary: artifact.summary,
    })),
    guardEvents: spec.guardEvents,
    metrics: spec.metrics,
    commands: spec.commands,
  };
}

const minute = 60_000;

const quotaResearch: GateState[] = [
  gate({
    gate: 'intake',
    status: 'passed',
    durationMs: 8_000,
    result: 'CU-86c1abcd · 2 roles',
    startedMinutesAgo: 2_600,
    commands: [{ command: 'wizrelay hub new 86c1abcd --roles backend,frontend', exitCode: 0 }],
    checks: [
      ['pass', 'Tracker reachable — ClickUp task 86c1abcd', '', 'clickup mcp · read-only'],
      ['pass', 'Reference normalised 86c1abcd → CU-86c1abcd'],
      ['pass', 'Roles resolved against the role catalogue: backend, frontend', 'wizrelay-hub.json'],
      ['pass', 'Package folder created', 'tasks/CU-86c1abcd-tenant-quota/'],
      ['pass', 'task.json written as draft v0', 'tasks/CU-86c1abcd-tenant-quota/task.json'],
    ],
    artifacts: [
      { path: 'tasks/CU-86c1abcd-tenant-quota/', summary: 'skeleton · 8 files', owner: 'researcher' },
    ],
    metrics: { duration: '8s', started: '2026-10-29 08:41' },
  }),
  gate({
    gate: 'research',
    status: 'passed',
    durationMs: 130 * minute,
    result: '0 placeholders · 14 citations',
    startedMinutesAgo: 2_580,
    checks: [
      [
        'pass',
        'Required files present — research, scope, acceptance, decisions, contracts, roles/backend, roles/frontend',
      ],
      ['pass', 'No {{placeholder}} left', '', '', 'was 6 at first draft'],
      ['pass', 'Every current-state claim carries a file:line citation', 'research.md', '', '14 citations'],
      ['pass', 'Each acceptance criterion has a verification line', 'acceptance.md'],
      ['pass', 'Signals set — complexity medium · risk high · ambiguity low', 'task.json'],
    ],
    artifacts: [
      { path: 'research.md', summary: '+212 lines', owner: 'researcher' },
      { path: 'attachments/sequence-quota.png', summary: '412 KB', owner: 'researcher' },
    ],
    metrics: { duration: '2h 10m', attachments: '1 · 412 KB of 20 MB' },
  }),
  gate({
    gate: 'validate',
    status: 'passed',
    durationMs: 41_000,
    result: 'clean on re-run',
    startedMinutesAgo: 2_440,
    commands: [{ command: 'wizrelay hub validate CU-86c1abcd', exitCode: 0 }],
    checks: [
      ['pass', 'Schema valid — task.json against task.schema.json'],
      ['pass', 'Acceptance-criteria grammar — 4 criteria', 'acceptance.md'],
      ['pass', 'Decision grammar — D-001 … D-004', 'decisions.md'],
      ['pass', 'Scope globs valid — no .., no absolute paths, no drive letters', 'task.json'],
      ['pass', 'Every role has a slice file', 'roles/'],
      ['pass', 'Contracts present (multi-role)', 'contracts.md'],
      [
        'skip',
        'Critic (advisory): contracts.md does not say what happens on a 404',
        'contracts.md:22',
        'critic · restricted agent',
      ],
    ],
    findings: [
      {
        id: 'F1',
        severity: 'advisory',
        source: 'critic',
        message: 'contracts.md does not say what happens on a 404',
        loc: 'contracts.md:22',
      },
    ],
    artifacts: [
      { path: '.validation.md', summary: 'stays in the hub, never published', owner: 'researcher' },
    ],
    metrics: { runs: '2 (first: 2 errors)', duration: '41s' },
  }),
  gate({
    gate: 'publish',
    status: 'passed',
    durationMs: 65_000,
    result: 'v2 · f95f2307ad3c',
    startedMinutesAgo: 2_400,
    commands: [
      {
        command: 'wizrelay hub publish-prep CU-86c1abcd --summary "Retry-After upper bound (D-004)"',
        exitCode: 0,
      },
      { command: 'git add tasks/CU-86c1abcd-tenant-quota && git commit -m "publish CU-86c1abcd v2: Retry-After upper bound (D-004)"', exitCode: 0 },
      { command: 'git push origin main', exitCode: 0 },
    ],
    checks: [
      ['pass', 'Validation had no errors'],
      ['pass', 'Version bumped v1 → v2', 'task.json'],
      ['pass', 'status set to published'],
      ['pass', 'Changelog: Retry-After upper bound (D-004)'],
      ['pass', 'Commit created f95f2307ad3c'],
      ['pass', 'Pushed origin/main — approved by you'],
      [
        'pass',
        'Tracker comment posted — approved by you',
        '',
        '',
        '[WIZRELAY-PUBLISH] CU-86c1abcd — research v2 published',
      ],
    ],
    artifacts: [{ path: 'commit f95f2307ad3c', summary: 'acme/research-hub · main', owner: 'researcher' }],
    metrics: { approvals: '2 of 2 (push, comment)' },
  }),
];

const scopePrompt: GatePrompt = {
  id: 'P-impl-scope',
  gate: 'implement',
  variant: 'scope',
  question: 'app/services/notifier.py is outside the scope of CU-86c1abcd',
  detail:
    'The quota middleware wants to notify a tenant on the first limit hit. Nothing in the package asks for a notification, and the file is not in this role’s allow list.',
  scope: {
    file: 'app/services/notifier.py',
    allow: ['app/quota/**', 'tests/quota/**'],
    deny: ['app/billing/**'],
    decision: 'ask',
  },
  options: [
    {
      id: 'allow-once',
      label: 'Allow once',
      meaning: 'This edit goes through and the audit reports it as an allowed out-of-scope change.',
      cost: 'Verify caps the result at PARTIAL while the change is unexplained.',
    },
    {
      id: 'refuse',
      label: 'Refuse',
      meaning: 'The edit is blocked. Claude continues with the steps that do not need it.',
    },
    {
      id: 'handoff',
      label: 'Ask the researcher instead',
      meaning: 'A question is written to questions.md and offered to the tracker.',
      handoff: true,
    },
  ],
  status: 'open',
  askedAt: ago(14),
  pinned: true,
};

const quotaBackend: GateState[] = [
  gate({
    gate: 'pull',
    status: 'passed',
    durationMs: 6_000,
    result: 'lock written · T2-standard',
    startedMinutesAgo: 1_460,
    commands: [{ command: 'wizrelay pull CU-86c1abcd', exitCode: 0 }],
    checks: [
      ['pass', 'Package is published'],
      ['pass', 'Files copied read-only — 9 files', '.wizrelay/tasks/CU-86c1abcd-tenant-quota/'],
      ['pass', '.lock.json written with sha256 per file', '.lock.json'],
      ['pass', 'Hub commit recorded f95f2307ad3c'],
      ['pass', 'Integrity clean'],
      ['pass', 'Routing computed — T2-standard, score 6'],
      ['pass', 'Role backend has a scope'],
      [
        'skip',
        'Briefing: contracts.md does not say what happens on a 404',
        'contracts.md:22',
        '',
        'ambiguous in package',
      ],
    ],
    artifacts: [
      {
        path: '.wizrelay/tasks/CU-86c1abcd-tenant-quota/',
        summary: '9 files · read-only',
        owner: 'researcher',
      },
      { path: '.lock.json', summary: 'version 2 · pulled 2026-10-30 09:12', owner: 'developer' },
    ],
    metrics: { duration: '6s' },
  }),
  gate({
    gate: 'plan',
    status: 'passed',
    durationMs: 571_000,
    result: '7 steps · approved',
    startedMinutesAgo: 1_450,
    commands: [{ command: 'wizrelay brief --phase plan', exitCode: 0 }],
    checks: [
      ['pass', 'Every step names an acceptance criterion — 7 / 7', 'plan.md'],
      ['pass', 'Every touched path is inside allow scope'],
      ['pass', 'Every step names the test command — pytest -q'],
      ['pass', 'Assumptions listed separately — 2'],
      ['pass', 'Out-of-scope ideas listed separately — 1 (notifier on first limit hit)'],
    ],
    prompts: [
      {
        id: 'P-plan-approve',
        gate: 'plan',
        variant: 'approval',
        question: 'Approve the plan and write it to plan.md',
        detail: '7 steps, each tied to an acceptance criterion.',
        payload: { command: 'write plan.md', target: '.wizrelay/tasks/CU-86c1abcd-tenant-quota/plan.md' },
        status: 'answered',
        askedAt: ago(1_447),
        answeredAt: ago(1_441),
        answer: { optionId: 'approve', by: 'you' },
      },
    ],
    artifacts: [{ path: 'plan.md', summary: '7 steps · - [ ] checkboxes', owner: 'developer' }],
    metrics: { duration: '9m 31s', 'edits before approval': '1 step edited' },
  }),
  gate({
    gate: 'implement',
    status: 'waiting',
    durationMs: 38 * minute,
    result: 'Scope permission needed',
    startedMinutesAgo: 38,
    checks: [
      ['pass', 'Plan steps 1–4 checked', 'plan.md', '', '4 / 7'],
      ['pass', 'Last test run — 12 passed', '', 'pytest tests/quota -q', 'exit 0 · 12 passed'],
      [
        'fail',
        'Guard deny — app/billing/invoice.py',
        'app/billing/**',
        '',
        'app/billing/invoice.py is explicitly denied by the scope of CU-86c1abcd (pattern app/billing/**).',
      ],
      [
        'skip',
        'Guard ask — app/services/notifier.py is outside the scope',
        'allow app/quota/**, tests/quota/**',
        '',
        'waiting for your answer',
      ],
      ['skip', 'Open question Q-001 blocks AC-1', 'questions.md', '', '3 days'],
    ],
    prompts: [scopePrompt],
    guardEvents: [
      {
        at: ago(26),
        decision: 'deny',
        file: 'app/billing/invoice.py',
        pattern: 'app/billing/**',
        outcome: 'refused',
      },
      {
        at: ago(14),
        decision: 'ask',
        file: 'app/services/notifier.py',
        allow: ['app/quota/**', 'tests/quota/**'],
      },
    ],
    artifacts: [
      { path: 'app/quota/middleware.py', summary: '+48 −3', owner: 'developer' },
      { path: 'app/quota/counter.py', summary: '+61 new', owner: 'developer' },
      { path: 'tests/quota/test_limits.py', summary: '+74 new', owner: 'developer' },
    ],
    metrics: {
      steps: '4 / 7',
      tests: '12 passed · 0 failed',
      'guard events': '1 deny · 1 ask',
      'time waiting on you': '14 min',
    },
  }),
  gate({
    gate: 'verify',
    status: 'blocked',
    result: 'Needs Implement to pass',
    checks: [
      ['skip', 'AC-1 · AC-2 · AC-3 · AC-4 — PASS / FAIL / NOT COVERED with evidence'],
      ['skip', 'Full test suite — pytest -q'],
      ['skip', 'Scope audit — wizrelay audit --format json'],
      ['skip', 'Research integrity against .lock.json'],
    ],
  }),
  gate({
    gate: 'ship',
    status: 'blocked',
    result: 'Needs Verify to pass',
    checks: [
      ['pass', 'Branch name contains the task id', 'feature/CU-86c1abcd-tenant-quota'],
      ['skip', 'Package folder committed'],
      ['skip', 'Commit messages reference acceptance criteria'],
      [
        'skip',
        'CI audit',
        '',
        'wizrelay audit --branch feature/CU-86c1abcd-tenant-quota --base origin/main',
      ],
    ],
  }),
];

const quotaFrontend: GateState[] = [
  gate({
    gate: 'pull',
    status: 'passed',
    durationMs: 6_000,
    result: 'lock written · T1-routine',
    startedMinutesAgo: 120,
    commands: [{ command: 'wizrelay pull CU-86c1abcd', exitCode: 0 }],
    checks: [
      ['pass', 'Package is published'],
      ['pass', 'Files copied read-only — 9 files'],
      ['pass', '.lock.json written'],
      ['pass', 'Routing computed — T1-routine, role signals low / low'],
      ['pass', 'Role frontend has a scope — src/features/quota/**'],
    ],
    artifacts: [{ path: '.lock.json', summary: 'version 2', owner: 'developer' }],
  }),
  gate({
    gate: 'plan',
    status: 'running',
    durationMs: 108_000,
    result: 'drafting',
    startedMinutesAgo: 2,
    checks: [
      ['skip', 'Drafting steps against AC-1 and AC-4'],
      ['skip', 'Every step names an acceptance criterion'],
      ['skip', 'Every touched path is inside allow scope'],
    ],
    metrics: { running: '1m 48s' },
  }),
  gate({ gate: 'implement', status: 'blocked', result: 'Preconditions met after Plan' }),
  gate({ gate: 'verify', status: 'blocked' }),
  gate({ gate: 'ship', status: 'blocked' }),
];

function researchTrack(statuses: GateStatus[], result?: string[]): GateState[] {
  const ids: GateId[] = ['intake', 'research', 'validate', 'publish'];
  return ids.map((id, index) =>
    gate({
      gate: id,
      status: statuses[index] ?? 'idle',
      result: result?.[index],
      durationMs: statuses[index] === 'passed' ? (index + 1) * 40_000 : undefined,
      startedMinutesAgo: 900 - index * 30,
    }),
  );
}

function deliveryTrack(statuses: GateStatus[], results: (string | undefined)[] = []): GateState[] {
  const ids: GateId[] = ['pull', 'plan', 'implement', 'verify', 'ship'];
  return ids.map((id, index) =>
    gate({
      gate: id,
      status: statuses[index] ?? 'idle',
      result: results[index],
      verdict:
        id === 'verify'
          ? statuses[index] === 'passed'
            ? 'PASS'
            : statuses[index] === 'warned'
              ? 'PARTIAL'
              : statuses[index] === 'failed'
                ? 'FAIL'
                : undefined
          : undefined,
      durationMs: statuses[index] === 'idle' || statuses[index] === 'blocked' ? undefined : (index + 2) * 50_000,
      startedMinutesAgo: 400 - index * 20,
    }),
  );
}

const publishApproval: GatePrompt = {
  id: 'P-publish-push',
  gate: 'publish',
  variant: 'approval',
  question: 'Approve push of research v2 to acme/research-hub · main',
  detail: 'This is the first of two approvals. The tracker comment is approved separately.',
  payload: {
    command: 'git push origin main',
    target: 'acme/research-hub · main',
    text: '2 files changed: tasks/CU-86c1c3d8-rate-limit-headers/task.json, decisions.md',
    confirmWord: 'push',
    step: { index: 1, total: 2 },
  },
  status: 'open',
  askedAt: ago(31),
  pinned: true,
};

function relay(
  partial: Omit<Relay, 'tracks' | 'questions' | 'createdAt' | 'updatedAt'> & {
    tracks: Track[];
    questions?: Question[];
    updatedMinutesAgo: number;
  },
): Relay {
  const { updatedMinutesAgo, questions, ...rest } = partial;
  return {
    ...rest,
    questions: questions ?? [],
    createdAt: ago(updatedMinutesAgo + 2_000),
    updatedAt: ago(updatedMinutesAgo),
  };
}

const HUB = { repo: 'acme/research-hub', commit: 'f95f2307ad3c' };
const tracker = (ref: string) => ({
  type: 'clickup',
  ref,
  url: `https://app.clickup.com/t/${ref}`,
});

export function sampleRelays(): Relay[] {
  return [
    relay({
      id: 'CU-86c1abcd',
      title: 'Tenant-based daily API request quota',
      slug: 'tenant-based-daily-api-request-quota',
      tracker: tracker('86c1abcd'),
      version: 2,
      packageStatus: 'published',
      roles: ['backend', 'frontend'],
      repos: { backend: 'acme/api-service', frontend: 'acme/web-app' },
      enforcement: 'strict',
      scope: {
        backend: { allow: ['app/quota/**', 'tests/quota/**'], deny: ['app/billing/**'] },
        frontend: { allow: ['src/features/quota/**'], deny: [] },
      },
      hub: HUB,
      updatedMinutesAgo: 14,
      tracks: [
        { id: 'research', gates: quotaResearch },
        { id: 'delivery', role: 'backend', repo: 'acme/api-service', gates: quotaBackend },
        { id: 'delivery', role: 'frontend', repo: 'acme/web-app', gates: quotaFrontend },
      ],
      questions: [
        {
          id: 'Q-001',
          title: 'Is Retry-After seconds or a date?',
          status: 'ANSWERED',
          askedAt: ago(4_400),
          blocks: 'AC-1',
          relayId: 'CU-86c1abcd',
          role: 'backend',
          decisionId: 'D-004',
          body: 'acceptance.md AC-1 says "Retry-After", contracts.md says "a timestamp". Which one binds?',
          trackerComment: '[WIZRELAY-Q] Q-001 — CU-86c1abcd — backend',
        },
      ],
    }),
    relay({
      id: 'CU-86c1c3d8',
      title: 'Rate-limit headers in the public API docs',
      slug: 'rate-limit-headers-in-the-public-api-docs',
      tracker: tracker('86c1c3d8'),
      version: 1,
      hubVersion: 2,
      packageStatus: 'published',
      roles: ['frontend'],
      repos: { frontend: 'acme/web-app' },
      enforcement: 'ask',
      scope: { frontend: { allow: ['docs/api/**'], deny: [] } },
      hub: HUB,
      updatedMinutesAgo: 31,
      tracks: [
        {
          id: 'research',
          gates: [

            ...researchTrack(['passed', 'passed', 'warned']).slice(0, 3),
            gate({
              gate: 'publish',
              status: 'waiting',
              result: 'Approval 1 of 2',
              startedMinutesAgo: 33,
              prompts: [publishApproval],
              checks: [
                ['pass', 'Validation had no errors'],
                ['pass', 'Version bumped v1 → v2', 'task.json'],
                ['skip', 'Commit created'],
                ['skip', 'Pushed to origin/main — waiting for your approval'],
                ['skip', 'Tracker comment posted'],
              ],
            }),
          ],
        },
        {
          id: 'delivery',
          role: 'frontend',
          repo: 'acme/web-app',
          gates: deliveryTrack(['blocked', 'blocked', 'blocked', 'blocked', 'blocked']),
        },
      ],
    }),
    relay({
      id: 'CU-86c1b2f0',
      title: 'Webhook delivery retry with backoff',
      slug: 'webhook-delivery-retry-with-backoff',
      tracker: tracker('86c1b2f0'),
      version: 1,
      packageStatus: 'published',
      roles: ['backend'],
      repos: { backend: 'acme/api-service' },
      enforcement: 'strict',
      scope: { backend: { allow: ['app/webhooks/**', 'tests/webhooks/**'], deny: [] } },
      hub: HUB,
      updatedMinutesAgo: 120,
      tracks: [
        { id: 'research', gates: researchTrack(['passed', 'passed', 'passed', 'passed']) },
        {
          id: 'delivery',
          role: 'backend',
          repo: 'acme/api-service',
          gates: deliveryTrack(
            ['passed', 'passed', 'passed', 'failed', 'blocked'],
            [undefined, '6 steps', '6 / 6 steps', 'AC-2 FAIL', undefined],
          ),
        },
      ],
      questions: [
        {
          id: 'Q-002',
          title: 'Does the retry budget reset per endpoint or per subscription?',
          status: 'OPEN',
          askedAt: ago(1_500),
          blocks: 'AC-2',
          relayId: 'CU-86c1b2f0',
          role: 'backend',
          body: 'acceptance.md AC-2 counts retries but does not say what the counter is keyed by.',
          trackerComment: '[WIZRELAY-Q] Q-002 — CU-86c1b2f0 — backend',
        },
      ],
    }),
    relay({
      id: 'CU-86c19e47',
      title: 'Export usage report as CSV',
      slug: 'export-usage-report-as-csv',
      tracker: tracker('86c19e47'),
      version: 3,
      packageStatus: 'published',
      roles: ['backend', 'frontend'],
      repos: { backend: 'acme/api-service', frontend: 'acme/web-app' },
      enforcement: 'strict',
      scope: {
        backend: { allow: ['app/reports/**', 'tests/reports/**'], deny: [] },
        frontend: { allow: ['src/features/reports/**'], deny: [] },
      },
      hub: HUB,
      updatedMinutesAgo: 4_320,
      tracks: [
        { id: 'research', gates: researchTrack(['passed', 'passed', 'passed', 'passed']) },
        {
          id: 'delivery',
          role: 'backend',
          repo: 'acme/api-service',
          gates: deliveryTrack(
            ['passed', 'passed', 'handoff', 'blocked', 'blocked'],
            [undefined, '5 steps', 'Q-003 open · 3 days', undefined, undefined],
          ),
        },
        {
          id: 'delivery',
          role: 'frontend',
          repo: 'acme/web-app',
          gates: deliveryTrack(
            ['passed', 'passed', 'passed', 'passed', 'running'],
            [undefined, undefined, undefined, 'PASS', 'CI running'],
          ),
        },
      ],
      questions: [
        {
          id: 'Q-003',
          title: 'Which timezone does the daily bucket use?',
          status: 'OPEN',
          askedAt: ago(4_320),
          blocks: 'AC-3',
          relayId: 'CU-86c19e47',
          role: 'backend',
          body: 'The package says "daily" without a timezone. UTC and tenant-local give different rows.',
          trackerComment: '[WIZRELAY-Q] Q-003 — CU-86c19e47 — backend',
        },
      ],
    }),
    relay({
      id: 'CU-86c1d0aa',
      title: 'Remove legacy v1 quota endpoint',
      slug: 'remove-legacy-v1-quota-endpoint',
      tracker: tracker('86c1d0aa'),
      version: 1,
      packageStatus: 'published',
      roles: ['backend'],
      repos: { backend: 'acme/api-service' },
      enforcement: 'strict',
      scope: { backend: { allow: ['app/api/v1/**'], deny: [] } },
      hub: HUB,
      updatedMinutesAgo: 3,
      tracks: [
        { id: 'research', gates: researchTrack(['passed', 'passed', 'passed', 'passed']) },
        {
          id: 'delivery',
          role: 'backend',
          repo: 'acme/api-service',
          gates: deliveryTrack(
            ['passed', 'passed', 'running', 'blocked', 'blocked'],
            [undefined, '3 steps', '2 / 3 steps', undefined, undefined],
          ),
        },
      ],
    }),
    relay({
      id: 'CU-86c18a21',
      title: 'Tenant admin can rotate API keys',
      slug: 'tenant-admin-can-rotate-api-keys',
      tracker: tracker('86c18a21'),
      version: 2,
      packageStatus: 'published',
      roles: ['backend', 'frontend'],
      repos: { backend: 'acme/api-service', frontend: 'acme/web-app' },
      enforcement: 'strict',
      scope: {
        backend: { allow: ['app/auth/keys/**', 'tests/auth/**'], deny: ['app/billing/**'] },
        frontend: { allow: ['src/features/keys/**'], deny: [] },
      },
      hub: HUB,
      updatedMinutesAgo: 300,
      tracks: [
        { id: 'research', gates: researchTrack(['passed', 'passed', 'passed', 'passed']) },
        {
          id: 'delivery',
          role: 'backend',
          repo: 'acme/api-service',
          gates: [

            ...deliveryTrack(['passed', 'passed', 'passed'], [undefined, '9 steps', '9 / 9 steps']).slice(0, 3),
            gate({
              gate: 'verify',
              status: 'warned',
              verdict: 'PARTIAL',
              durationMs: 4 * minute,
              result: 'PARTIAL · 1 out of scope',
              startedMinutesAgo: 320,
              guardEvents: [
                {
                  at: ago(420),
                  decision: 'deny',
                  file: 'app/billing/plan.py',
                  pattern: 'app/billing/**',
                  outcome: 'refused',
                },
              ],
              checks: [
                ['pass', 'AC-1 — PASS', '', 'pytest tests/auth/test_rotate.py -q', '3 passed'],
                ['pass', 'AC-2 — PASS', '', 'pytest tests/auth/test_revoke.py -q', '2 passed'],
                ['fail', 'Scope audit — 1 path out of scope', 'app/billing/plan.py'],
              ],
            }),
            gate({ gate: 'ship', status: 'idle' }),
          ],
        },
        {
          id: 'delivery',
          role: 'frontend',
          repo: 'acme/web-app',
          gates: deliveryTrack(['passed', 'passed', 'passed', 'passed', 'passed'], [
            undefined,
            undefined,
            undefined,
            'PASS',
            'merged',
          ]),
        },
      ],
    }),
    relay({
      id: 'CU-86c17f05',
      title: 'Audit log retention to 90 days',
      slug: 'audit-log-retention-to-90-days',
      tracker: tracker('86c17f05'),
      version: 1,
      packageStatus: 'published',
      roles: ['backend'],
      repos: { backend: 'acme/api-service' },
      enforcement: 'strict',
      scope: { backend: { allow: ['app/audit/**', 'tests/audit/**'], deny: [] } },
      hub: HUB,
      updatedMinutesAgo: 1_440,
      tracks: [
        { id: 'research', gates: researchTrack(['passed', 'passed', 'passed', 'passed']) },
        {
          id: 'delivery',
          role: 'backend',
          repo: 'acme/api-service',
          gates: deliveryTrack(['passed', 'passed', 'passed', 'passed', 'passed'], [
            undefined,
            undefined,
            undefined,
            'PASS',
            'merged',
          ]),
        },
      ],
    }),
  ];
}
