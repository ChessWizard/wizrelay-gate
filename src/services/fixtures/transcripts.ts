import type { GateId } from '@/core/gates/gates';
import type { DiffLine } from '@/core/relay/events';
import type { Check, GatePrompt } from '@/core/relay/types';
import type { Verdict } from '@/core/status/status';

/**
 * Deterministic gate transcripts.
 *
 * The scripted engine plays these when there is no Claude Code session to drive — which
 * is how the dashboard is explorable end to end without an API key, and how the designs
 * can be reviewed against something that actually moves. Live mode replaces this engine
 * with `claude -p`, and the two emit the same events.
 *
 * A `prompt` step genuinely blocks: nothing after it runs until a person answers, and the
 * answer picks the branch that follows.
 */
export type ScriptStep =
  | { t: 'message'; who: 'user' | 'claude'; text: string; delay?: number }
  | { t: 'thinking'; text: string; delay?: number }
  | { t: 'tool'; name: string; target?: string; result?: string; delay?: number }
  | { t: 'command'; command: string; output?: string; exitCode?: number; delay?: number }
  | { t: 'diff'; file: string; owner: 'researcher' | 'developer'; lines: DiffLine[]; delay?: number }
  | { t: 'check'; check: Omit<Check, 'id'>; delay?: number }
  | { t: 'guard'; file: string; decision: 'deny' | 'ask'; pattern?: string; allow?: string[] }
  | { t: 'artifact'; path: string; summary?: string; owner?: 'researcher' | 'developer' }
  | {
      t: 'prompt';
      prompt: Omit<GatePrompt, 'gate' | 'status' | 'askedAt'>;
      branches?: Record<string, ScriptStep[]>;
    }
  | { t: 'done'; verdict: Verdict; summary: string };

const diff = (sign: DiffLine['sign'], line: number, text: string): DiffLine => ({ sign, line, text });

const implementScript: ScriptStep[] = [
  {
    t: 'message',
    who: 'user',
    text: 'Continue with step 5: notify the tenant when they first hit the limit.',
  },
  { t: 'thinking', text: 'Reading the plan and the scope before touching anything.', delay: 400 },
  {
    t: 'tool',
    name: 'Read',
    target: '.wizrelay/tasks/CU-86c1abcd-tenant-quota/plan.md',
    result: 'ok',
    delay: 500,
  },
  { t: 'tool', name: 'Grep', target: '"notify" in app/ · 6 matches', result: 'ok', delay: 400 },
  {
    t: 'message',
    who: 'claude',
    text: 'Step 5 says “no new notification channel”, and the plan lists the notifier under out-of-scope ideas. Before I touch it I will check where the invoice hook lives, because the first-limit event is also billed.',
    delay: 600,
  },
  { t: 'tool', name: 'Edit', target: 'app/billing/invoice.py', result: 'denied', delay: 500 },
  { t: 'guard', file: 'app/billing/invoice.py', decision: 'deny', pattern: 'app/billing/**' },
  {
    t: 'check',
    check: {
      status: 'fail',
      message: 'Guard deny — app/billing/invoice.py',
      loc: 'app/billing/**',
      output:
        'app/billing/invoice.py is explicitly denied by the scope of CU-86c1abcd (pattern app/billing/**).',
    },
  },
  {
    t: 'message',
    who: 'claude',
    text: 'Understood — I will leave billing alone. The tenant notification would need app/services/notifier.py, which is outside the allow list, so I am asking first.',
    delay: 500,
  },
  {
    t: 'diff',
    file: 'app/services/notifier.py',
    owner: 'developer',
    lines: [
      diff(' ', 27, 'def notify_tenant(tenant_id: str, event: str) -> None:'),
      diff('+', 28, '    if event == "quota.first_limit_hit":'),
      diff('+', 29, '        _send(tenant_id, template="quota_limit_reached")'),
    ],
  },
  { t: 'guard', file: 'app/services/notifier.py', decision: 'ask', allow: ['app/quota/**', 'tests/quota/**'] },
  {
    t: 'prompt',
    prompt: {
      id: 'P-impl-scope',
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
      pinned: true,
    },
    branches: {
      'allow-once': [
        {
          t: 'message',
          who: 'claude',
          text: 'Allowed once. I am writing the notifier hook and recording it as an out-of-scope change so the audit and the verification report both carry it.',
          delay: 400,
        },
        { t: 'tool', name: 'Edit', target: 'app/services/notifier.py · +6 −0', result: 'written', delay: 400 },
        {
          t: 'check',
          check: {
            status: 'fail',
            message: 'Out of scope, allowed once — app/services/notifier.py',
            loc: 'allow app/quota/**, tests/quota/**',
            output: 'Verify will cap the result at PARTIAL until this change is explained.',
          },
        },
        { t: 'artifact', path: 'app/services/notifier.py', summary: '+6 −0', owner: 'developer' },
        {
          t: 'command',
          command: 'pytest tests/quota -q',
          output: '............                                                   [100%]\n12 passed in 2.04s',
          exitCode: 0,
          delay: 900,
        },
        { t: 'done', verdict: 'PARTIAL', summary: 'Step 5 done, with one allowed out-of-scope change' },
      ],
      refuse: [
        {
          t: 'message',
          who: 'claude',
          text: 'Refused. I am dropping the notification and continuing with step 6, which needs nothing outside the scope.',
          delay: 400,
        },
        {
          t: 'check',
          check: {
            status: 'pass',
            message: 'Out-of-scope edit refused — app/services/notifier.py',
            loc: 'app/services/notifier.py',
          },
        },
        {
          t: 'tool',
          name: 'Edit',
          target: 'app/quota/views.py · +22 −1',
          result: 'written',
          delay: 500,
        },
        { t: 'artifact', path: 'app/quota/views.py', summary: '+22 −1', owner: 'developer' },
        {
          t: 'command',
          command: 'pytest tests/quota -q',
          output: '..............                                                 [100%]\n14 passed in 2.21s',
          exitCode: 0,
          delay: 900,
        },
        {
          t: 'check',
          check: {
            status: 'pass',
            message: 'Plan steps 1–6 checked',
            loc: 'plan.md',
            output: '6 / 7',
          },
        },
        { t: 'done', verdict: 'PASS', summary: 'Step 6 done inside the scope; step 7 is the audit' },
      ],
      handoff: [
        {
          t: 'message',
          who: 'claude',
          text: 'Writing the question so the researcher can decide. I am keeping the notification out of the code until the answer comes back as a package version.',
          delay: 400,
        },
        {
          t: 'tool',
          name: 'Write',
          target: '.wizrelay/tasks/CU-86c1abcd-tenant-quota/questions.md · Q-004',
          result: 'ok',
          delay: 400,
        },
        {
          t: 'check',
          check: {
            status: 'pass',
            message: 'Q-004 written — blocks nothing, scope question',
            loc: 'questions.md',
          },
        },
        { t: 'artifact', path: 'questions.md', summary: 'Q-004 OPEN', owner: 'developer' },
        {
          t: 'prompt',
          prompt: {
            id: 'P-impl-q-comment',
            variant: 'approval',
            question: 'Post Q-004 to the tracker',
            detail: 'The comment is visible to the whole team.',
            payload: {
              text: '[WIZRELAY-Q] Q-004 — CU-86c1abcd — backend\n\nShould a tenant be notified on the first limit hit? That needs app/services/notifier.py, which is outside this role’s scope. Absent an answer I will ship without a notification.',
              target: 'ClickUp · 86c1abcd',
              confirmWord: 'post',
            },
            options: [
              { id: 'post', label: 'Post the comment' },
              { id: 'later', label: 'Not now — keep it local' },
            ],
          },
          branches: {
            post: [
              {
                t: 'message',
                who: 'claude',
                text: 'Posted. The gate now waits on the researcher; steps 6 and 7 do not depend on the answer, so I can continue with those.',
                delay: 400,
              },
              { t: 'done', verdict: 'PARTIAL', summary: 'Q-004 posted — waiting on the researcher' },
            ],
            later: [
              {
                t: 'message',
                who: 'claude',
                text: 'Kept local. Q-004 is in questions.md; nothing was posted.',
                delay: 300,
              },
              { t: 'done', verdict: 'PARTIAL', summary: 'Q-004 recorded locally' },
            ],
          },
        },
      ],
    },
  },
];

const planScript: ScriptStep[] = [
  { t: 'message', who: 'user', text: '/wizrelay:plan' },
  {
    t: 'command',
    command: 'wizrelay brief --phase plan',
    output:
      'Active task CU-86c1abcd · research v2 · role backend · scope mode strict · open questions 0',
    exitCode: 0,
  },
  { t: 'thinking', text: 'Mapping acceptance criteria to files and tests.', delay: 500 },
  {
    t: 'tool',
    name: 'Task',
    target: 'wizrelay:codebase-mapper · AC → files, symbols, tests',
    result: 'ok',
    delay: 800,
  },
  {
    t: 'message',
    who: 'claude',
    text: 'Seven steps, each tied to a criterion and to the project’s own test command. Two assumptions are listed separately, and one idea is out of scope: notifying a tenant on the first limit hit.',
    delay: 600,
  },
  {
    t: 'check',
    check: { status: 'pass', message: 'Every step names an acceptance criterion — 7 / 7', loc: 'plan.md' },
  },
  { t: 'check', check: { status: 'pass', message: 'Every touched path is inside allow scope' } },
  {
    t: 'check',
    check: { status: 'pass', message: 'Every step names the test command — pytest -q' },
  },
  {
    t: 'prompt',
    prompt: {
      id: 'P-plan-approve',
      variant: 'approval',
      question: 'Approve the plan and write it to plan.md',
      detail: '7 steps, 4 of them inside app/quota/**, 3 inside tests/quota/**.',
      payload: {
        command: 'write .wizrelay/tasks/CU-86c1abcd-tenant-quota/plan.md',
        target: 'plan.md · a developer file, never overwritten by pull',
      },
      options: [
        { id: 'approve', label: 'Approve the plan' },
        { id: 'revise', label: 'Ask for a revision' },
      ],
    },
    branches: {
      approve: [
        { t: 'tool', name: 'Write', target: 'plan.md · 7 steps', result: 'ok', delay: 400 },
        { t: 'artifact', path: 'plan.md', summary: '7 steps · - [ ] checkboxes', owner: 'developer' },
        {
          t: 'message',
          who: 'claude',
          text: 'Written. A goal that keeps the work bounded: /goal every step in plan.md is checked off, the acceptance tests pass, and wizrelay audit is clean; or stop after 30 turns',
          delay: 400,
        },
        { t: 'done', verdict: 'PASS', summary: '7 steps · approved' },
      ],
      revise: [
        {
          t: 'message',
          who: 'claude',
          text: 'Tell me which step to change and I will redraft it. Nothing has been written to plan.md.',
          delay: 300,
        },
        { t: 'done', verdict: 'PARTIAL', summary: 'Plan not written — revision requested' },
      ],
    },
  },
];

const verifyScript: ScriptStep[] = [
  { t: 'message', who: 'user', text: '/wizrelay:verify' },
  {
    t: 'message',
    who: 'claude',
    text: 'Running as wizrelay:test-engineer. I verify; I do not fix, and I cannot edit files by configuration.',
  },
  {
    t: 'command',
    command: 'pytest -q tests/quota/test_quota_exceeded.py',
    output: '3 passed in 0.42s',
    exitCode: 0,
    delay: 700,
  },
  { t: 'check', check: { status: 'pass', message: 'AC-1 — PASS', output: '3 passed in 0.42s' } },
  {
    t: 'command',
    command: 'pytest -q tests/quota/test_quota_concurrency.py',
    output: '1 passed in 1.90s',
    exitCode: 0,
    delay: 700,
  },
  { t: 'check', check: { status: 'pass', message: 'AC-2 — PASS', output: '1 passed in 1.90s' } },
  {
    t: 'check',
    check: {
      status: 'skip',
      message: 'AC-3 — NOT COVERED: nothing in the repository proves idempotent charging',
      loc: 'acceptance.md:41',
      output: 'Suggested test: tests/quota/test_quota_idempotency.py',
    },
  },
  {
    t: 'command',
    command: 'pytest -q tests/api/test_messages_quota.py',
    output: '2 passed in 0.61s',
    exitCode: 0,
    delay: 600,
  },
  { t: 'check', check: { status: 'pass', message: 'AC-4 — PASS', output: '2 passed in 0.61s' } },
  {
    t: 'command',
    command: 'pytest -q',
    output: '142 passed, 1 skipped in 18.42s',
    exitCode: 0,
    delay: 1_200,
  },
  { t: 'check', check: { status: 'pass', message: 'Full suite — 142 passed, 1 skipped' } },
  {
    t: 'command',
    command: 'wizrelay audit --no-fail --format md',
    output: '## Scope audit — CU-86c1abcd (backend)\n\nNo violations. 13 changed path(s) are all accounted for.',
    exitCode: 0,
    delay: 700,
  },
  { t: 'check', check: { status: 'pass', message: 'Scope audit — clean' } },
  { t: 'check', check: { status: 'pass', message: 'Research integrity — clean against .lock.json' } },
  { t: 'artifact', path: 'verification.md', summary: 'PARTIAL · AC-3 not covered', owner: 'developer' },
  {
    t: 'prompt',
    prompt: {
      id: 'P-verify-comment',
      variant: 'approval',
      question: 'Post the verification result to the tracker',
      payload: {
        text: '[WIZRELAY-VERIFY] CU-86c1abcd — backend — PARTIAL\n\nAC-1 PASS · AC-2 PASS · AC-3 NOT COVERED · AC-4 PASS\nFull suite: 142 passed, 1 skipped. Scope audit: clean.',
        target: 'ClickUp · 86c1abcd',
        confirmWord: 'post',
      },
      options: [
        { id: 'post', label: 'Post the comment' },
        { id: 'later', label: 'Not now' },
      ],
    },
    branches: {
      post: [{ t: 'done', verdict: 'PARTIAL', summary: 'PARTIAL · posted to the tracker' }],
      later: [{ t: 'done', verdict: 'PARTIAL', summary: 'PARTIAL · comment not posted' }],
    },
  },
];

const researchScript: ScriptStep[] = [
  { t: 'message', who: 'user', text: 'Draft the package from the tracker task, with evidence from the code.' },
  { t: 'tool', name: 'clickup_get_task', target: '86c1abcd', result: 'ok', delay: 600 },
  {
    t: 'message',
    who: 'claude',
    text: 'The task asks for a per-tenant daily quota. It also mentions a per-user limit in a comment, which I am recording as a risk rather than inventing scope for it. Three places in the code matter: the request middleware, the error builder and the billing aggregate.',
    delay: 700,
  },
  { t: 'tool', name: 'Grep', target: '"tenant" in app/ · 42 matches', result: 'ok', delay: 500 },
  { t: 'check', check: { status: 'pass', message: 'Required files present', loc: 'tasks/CU-86c1abcd-tenant-quota/' } },
  {
    t: 'check',
    check: { status: 'fail', message: '6 {{placeholder}} markers left — publication is blocked', loc: 'contracts.md' },
  },
  {
    t: 'prompt',
    prompt: {
      id: 'P-research-attach',
      variant: 'attachment',
      question: 'Attach the sequence diagram for the counter, if you have one',
      detail:
        'A picture of the upsert ordering would settle the concurrency question faster than prose. Up to 5 MB per file, 20 MB per package.',
      options: [{ id: 'skip', label: 'Continue without it' }],
    },
    branches: {
      '*': [
        {
          t: 'message',
          who: 'claude',
          text: 'Noted. I will describe the ordering in words and flag it for the critic to check.',
          delay: 400,
        },
        { t: 'artifact', path: 'research.md', summary: '+212 lines', owner: 'researcher' },
        { t: 'done', verdict: 'PARTIAL', summary: 'Draft written · placeholders remain' },
      ],
    },
  },
];

const intakeScript: ScriptStep[] = [
  {
    t: 'command',
    command: 'wizrelay hub new 86c1abcd --roles backend,frontend',
    output:
      'Created tasks/CU-86c1abcd-tenant-quota/\n  task.json (draft, v0) · research.md · scope.md · acceptance.md · decisions.md · contracts.md · roles/backend.md · roles/frontend.md',
    exitCode: 0,
    delay: 600,
  },
  { t: 'check', check: { status: 'pass', message: 'Reference normalised 86c1abcd → CU-86c1abcd' } },
  { t: 'check', check: { status: 'pass', message: 'Roles resolved against the role catalogue', loc: 'wizrelay-hub.json' } },
  { t: 'check', check: { status: 'pass', message: 'task.json written as draft v0' } },
  { t: 'artifact', path: 'tasks/CU-86c1abcd-tenant-quota/', summary: 'skeleton · 8 files', owner: 'researcher' },
  { t: 'done', verdict: 'PASS', summary: 'Draft package created' },
];

const validateScript: ScriptStep[] = [
  {
    t: 'command',
    command: 'wizrelay hub validate CU-86c1abcd',
    output:
      'error  acceptance.md:41  AC-3 has no verification line\nerror  contracts.md:18  {{placeholder}} left in the error body\nwarning  task.json:21  ambiguity is high',
    exitCode: 1,
    delay: 800,
  },
  { t: 'check', check: { status: 'fail', message: 'AC-3 has no verification line', loc: 'acceptance.md:41' } },
  { t: 'check', check: { status: 'fail', message: '{{placeholder}} left in the error body', loc: 'contracts.md:18' } },
  { t: 'check', check: { status: 'skip', message: 'ambiguity is high (advisory)', loc: 'task.json:21' } },
  {
    t: 'message',
    who: 'claude',
    text: 'Two errors block publication. Running as wizrelay:research-critic, with no write access: the package answers the tracker task, but contracts.md does not say what happens on a 404, and AC-2 restates D-002 in different words.',
    delay: 700,
  },
  { t: 'artifact', path: '.validation.md', summary: 'never published', owner: 'researcher' },
  { t: 'done', verdict: 'FAIL', summary: '2 errors · 4 advisory findings' },
];

const publishScript: ScriptStep[] = [
  {
    t: 'command',
    command: 'wizrelay hub publish-prep CU-86c1abcd --summary "Retry-After upper bound (D-004)"',
    output: 'version 1 → 2 · status published · changelog appended',
    exitCode: 0,
    delay: 600,
  },
  { t: 'check', check: { status: 'pass', message: 'Version bumped v1 → v2', loc: 'task.json' } },
  {
    t: 'prompt',
    prompt: {
      id: 'P-publish-push',
      variant: 'approval',
      question: 'Approve push of research v2 to acme/research-hub · main',
      detail: 'This is the first of two approvals. The tracker comment is approved separately.',
      payload: {
        command: 'git add tasks/CU-86c1abcd-tenant-quota && git commit -m "publish CU-86c1abcd v2: Retry-After upper bound (D-004)" && git push origin main',
        target: 'acme/research-hub · main',
        text: '2 files changed: task.json (+6 −2), decisions.md (+18)',
        confirmWord: 'push',
        step: { index: 1, total: 2 },
      },
      options: [
        { id: 'push', label: 'Approve push' },
        { id: 'copy', label: 'Copy the command and run it myself' },
      ],
      pinned: true,
    },
    branches: {
      push: [
        { t: 'command', command: 'git push origin main', output: 'f95f2307ad3c  main -> main', exitCode: 0, delay: 900 },
        { t: 'check', check: { status: 'pass', message: 'Pushed origin/main — approved by you' } },
        {
          t: 'prompt',
          prompt: {
            id: 'P-publish-comment',
            variant: 'approval',
            question: 'Approve the tracker comment',
            payload: {
              text: '[WIZRELAY-PUBLISH] CU-86c1abcd — research v2 published\n\nRetry-After upper bound (D-004). Pull with: /wizrelay:pull CU-86c1abcd',
              target: 'ClickUp · 86c1abcd',
              confirmWord: 'post',
              step: { index: 2, total: 2 },
            },
            options: [
              { id: 'post', label: 'Post the comment' },
              { id: 'later', label: 'Not now' },
            ],
          },
          branches: {
            post: [
              { t: 'check', check: { status: 'pass', message: 'Tracker comment posted — approved by you' } },
              { t: 'done', verdict: 'PASS', summary: 'v2 published · 2 of 2 approvals' },
            ],
            later: [{ t: 'done', verdict: 'PARTIAL', summary: 'v2 pushed · comment not posted' }],
          },
        },
      ],
      copy: [
        {
          t: 'message',
          who: 'claude',
          text: 'Nothing was pushed. The command is above, ready to run in your own terminal; this gate stays open until the push lands.',
          delay: 300,
        },
        { t: 'done', verdict: 'PARTIAL', summary: 'Prepared · push not performed here' },
      ],
    },
  },
];

const pullScript: ScriptStep[] = [
  {
    t: 'command',
    command: 'wizrelay pull CU-86c1abcd',
    output:
      'Task package ready: CU-86c1abcd — Tenant-based daily API request quota\n  Folder: .wizrelay/tasks/CU-86c1abcd-tenant-quota/\n  Research v2 · hub commit f95f2307 · role: backend · scope mode: strict\n\nT2-standard (score 6)\n  plan       opus    high\n  implement  sonnet  high\n  verify     sonnet  high\n  ask        sonnet  low',
    exitCode: 0,
    delay: 800,
  },
  { t: 'check', check: { status: 'pass', message: 'Package is published' } },
  { t: 'check', check: { status: 'pass', message: '.lock.json written with sha256 per file', loc: '.lock.json' } },
  { t: 'check', check: { status: 'pass', message: 'Routing computed — T2-standard, score 6' } },
  {
    t: 'check',
    check: {
      status: 'skip',
      message: 'Briefing: contracts.md does not say what happens on a 404',
      loc: 'contracts.md:22',
      output: 'ambiguous in package — this is what /wizrelay:ask is for',
    },
  },
  {
    t: 'message',
    who: 'claude',
    text: 'CU-86c1abcd v2 · role backend · strict. In scope: app/quota/**, tests/quota/**. Explicitly denied: app/billing/**. Your criteria: AC-1 Retry-After in seconds, AC-2 atomic counter, AC-3 idempotency, AC-4 per tenant. One gap: contracts.md does not say what happens on a 404.',
    delay: 600,
  },
  { t: 'artifact', path: '.lock.json', summary: 'version 2', owner: 'developer' },
  { t: 'done', verdict: 'PASS', summary: 'lock written · T2-standard' },
];

const shipScript: ScriptStep[] = [
  {
    t: 'prompt',
    prompt: {
      id: 'P-ship-commit',
      variant: 'input',
      question: 'The commit message',
      detail: 'Commit messages reference acceptance criteria, which is how a reviewer finds them.',
      destination: 'git commit -m',
      payload: { command: 'git commit -m "<message>"' },
      options: [{ id: 'commit', label: 'Commit' }],
    },
    branches: {
      '*': [
        { t: 'command', command: 'git commit -m "feat(quota): per-tenant daily limit (AC-1, AC-2, AC-4)"', output: '7 files changed, 205 insertions(+), 4 deletions(-)', exitCode: 0, delay: 700 },
        {
          t: 'prompt',
          prompt: {
            id: 'P-ship-push',
            variant: 'approval',
            question: 'Approve push of feature/CU-86c1abcd-tenant-quota',
            payload: {
              command: 'git push -u origin feature/CU-86c1abcd-tenant-quota',
              target: 'acme/api-service',
              confirmWord: 'push',
            },
            options: [
              { id: 'push', label: 'Approve push' },
              { id: 'copy', label: 'Copy the command and run it myself' },
            ],
          },
          branches: {
            push: [
              { t: 'command', command: 'git push -u origin feature/CU-86c1abcd-tenant-quota', output: 'branch set up to track origin', exitCode: 0, delay: 900 },
              { t: 'check', check: { status: 'pass', message: 'Branch name contains the task id', loc: 'feature/CU-86c1abcd-tenant-quota' } },
              { t: 'check', check: { status: 'pass', message: 'Package folder committed' } },
              {
                t: 'command',
                command: 'wizrelay audit --branch feature/CU-86c1abcd-tenant-quota --base origin/main',
                output: 'No violations. 13 changed path(s) are all accounted for.',
                exitCode: 0,
                delay: 1_100,
              },
              { t: 'check', check: { status: 'pass', message: 'CI audit — clean' } },
              { t: 'done', verdict: 'PASS', summary: 'pushed · CI audit clean' },
            ],
            copy: [{ t: 'done', verdict: 'PARTIAL', summary: 'committed · push not performed here' }],
          },
        },
      ],
    },
  },
];

export const TRANSCRIPTS: Record<GateId, ScriptStep[]> = {
  intake: intakeScript,
  research: researchScript,
  validate: validateScript,
  publish: publishScript,
  pull: pullScript,
  plan: planScript,
  implement: implementScript,
  verify: verifyScript,
  ship: shipScript,
};
