import type { AuditReport } from '@/core/audit/types';
import type {
  AcceptanceCriterion,
  Decision,
  Finding,
  PlanStep,
} from '@/core/relay/types';

/**
 * The package-level detail the sample relay shows: acceptance criteria with their
 * evidence, the decision record, the plan, the audit and the files. In live mode these
 * come from the package on disk and from `wizrelay audit --format json`; here they are
 * the sample the design was drawn against.
 */

export const SAMPLE_CRITERIA: AcceptanceCriterion[] = [
  {
    id: 'AC-1',
    title: 'Requests over the limit return 429 with Retry-After in seconds',
    roles: ['backend', 'frontend'],
    given: 'a tenant that has used its daily quota',
    when: 'another request arrives',
    then: 'the API answers 429 and sets Retry-After to the seconds until the next UTC midnight',
    verification: 'pytest tests/quota/test_quota_exceeded.py',
    result: 'PASS',
    evidence: { command: 'pytest -q tests/quota/test_quota_exceeded.py', output: '3 passed in 0.42s' },
  },
  {
    id: 'AC-2',
    title: 'The counter is atomic under concurrency',
    roles: ['backend'],
    given: 'two requests from the same tenant at the same moment',
    when: 'both increment the counter',
    then: 'exactly one of them is rejected and the stored count is correct',
    verification: 'pytest tests/quota/test_quota_concurrency.py',
    result: 'PASS',
    evidence: { command: 'pytest -q tests/quota/test_quota_concurrency.py', output: '1 passed in 1.90s' },
  },
  {
    id: 'AC-3',
    title: 'Repeated requests are idempotent',
    roles: ['backend'],
    given: 'a request that carries an idempotency key',
    when: 'it is replayed',
    then: 'the quota is charged once',
    verification: '',
    result: 'NOT COVERED',
  },
  {
    id: 'AC-4',
    title: 'The quota is per tenant, not per user',
    roles: ['backend', 'frontend'],
    given: 'two users of the same tenant',
    when: 'they send requests',
    then: 'both count against one tenant quota',
    verification: 'pytest tests/api/test_messages_quota.py',
    result: 'PASS',
    evidence: { command: 'pytest -q tests/api/test_messages_quota.py', output: '2 passed in 0.61s' },
  },
];

export const SAMPLE_DECISIONS: Decision[] = [
  {
    id: 'D-001',
    title: 'The quota window is a UTC calendar day',
    version: 1,
    date: '2026-10-29',
    question: 'Rolling 24 hours or a calendar day?',
    decision: 'A UTC calendar day, resetting at 00:00 UTC.',
    rationale: 'Billing already reports per UTC day; two windows would disagree in reports.',
    impact: 'The counter key carries the UTC date.',
  },
  {
    id: 'D-002',
    title: 'Over-quota requests are rejected, never queued',
    version: 1,
    date: '2026-10-29',
    question: 'Reject or queue?',
    decision: 'Reject with 429.',
    rationale: 'Queueing hides the limit and moves the cost to latency.',
    impact: 'No background queue in this task.',
  },
  {
    id: 'D-003',
    title: 'The limit lives in the tenant record',
    version: 1,
    date: '2026-10-29',
    question: 'Configuration or per-tenant field?',
    decision: 'A per-tenant field with a default from configuration.',
    rationale: 'Enterprise tenants already need different limits.',
    impact: 'A migration adds `tenants.daily_request_quota`.',
  },
  {
    id: 'D-004',
    title: 'Retry-After is capped at 3600 seconds',
    version: 2,
    date: '2026-10-30',
    question: 'Q-001 — is Retry-After seconds or a date, and is it bounded?',
    decision: 'Seconds, capped at 3600 even when the window is longer.',
    rationale: 'Clients retry blindly after long values; an hour is long enough to shed load.',
    impact: 'AC-1 keeps seconds; the cap is asserted in the test.',
  },
];

export const SAMPLE_PLAN: PlanStep[] = [
  {
    index: 1,
    done: true,
    text: 'Add the per-tenant quota field and its migration (AC-4)',
    criterion: 'AC-4',
    files: ['app/quota/models.py'],
    test: 'pytest -q tests/quota/test_models.py',
  },
  {
    index: 2,
    done: true,
    text: 'Count requests in an atomic upsert (AC-2)',
    criterion: 'AC-2',
    files: ['app/quota/counter.py'],
    test: 'pytest -q tests/quota/test_quota_concurrency.py',
  },
  {
    index: 3,
    done: true,
    text: 'Reject over-quota requests with 429 (AC-1)',
    criterion: 'AC-1',
    files: ['app/quota/middleware.py'],
    test: 'pytest -q tests/quota/test_quota_exceeded.py',
  },
  {
    index: 4,
    done: true,
    text: 'Set Retry-After in seconds, capped at 3600 (AC-1, D-004)',
    criterion: 'AC-1',
    files: ['app/quota/middleware.py'],
    test: 'pytest -q tests/quota/test_retry_after.py',
  },
  {
    index: 5,
    done: false,
    text: 'Charge the quota once for a replayed idempotency key (AC-3)',
    criterion: 'AC-3',
    files: ['app/quota/counter.py'],
    test: 'pytest -q tests/quota/test_quota_idempotency.py',
  },
  {
    index: 6,
    done: false,
    text: 'Expose the remaining quota on the tenant endpoint (AC-4)',
    criterion: 'AC-4',
    files: ['app/quota/views.py'],
    test: 'pytest -q tests/quota/test_views.py',
  },
  {
    index: 7,
    done: false,
    text: 'Run the full suite and the scope audit (all)',
    criterion: 'AC-1',
    files: [],
    test: 'pytest -q && wizrelay audit',
  },
];

export const SAMPLE_AUDIT: AuditReport = {
  schema_version: 1,
  task_id: 'CU-86c1abcd',
  role: 'backend',
  enforcement: 'strict',
  scope_defined: true,
  base: 'origin/main',
  base_available: true,
  in_scope: [
    'app/quota/__init__.py',
    'app/quota/counter.py',
    'app/quota/middleware.py',
    'app/quota/models.py',
    'tests/quota/__init__.py',
    'tests/quota/test_limits.py',
    'tests/quota/test_quota_concurrency.py',
    'tests/quota/test_quota_exceeded.py',
    'tests/quota/test_retry_after.py',
  ],
  out_of_scope: [],
  forbidden: [],
  incidental: [
    '.wizrelay/tasks/CU-86c1abcd-tenant-quota/plan.md',
    'CLAUDE.md',
    '.claude/settings.json',
    '.gitignore',
  ],
  integrity: { changed: [], missing: [], unlocked: [] },
  violations: 0,
  clean: true,
  notes: [],
};

export const SAMPLE_VALIDATION_FINDINGS: Finding[] = [
  {
    id: 'V1',
    severity: 'blocking',
    source: 'validate',
    message: 'AC-3 has no verification line, so nothing can prove it',
    loc: 'acceptance.md:41',
  },
  {
    id: 'V2',
    severity: 'blocking',
    source: 'validate',
    message: '{{placeholder}} left in the contract for the error body',
    loc: 'contracts.md:18',
  },
  {
    id: 'V3',
    severity: 'advisory',
    source: 'validate',
    message: 'ambiguity is still high, which is the largest single source of scope drift',
    loc: 'task.json:21',
  },
  {
    id: 'V4',
    severity: 'advisory',
    source: 'critic',
    message: 'contracts.md does not say what happens on a 404',
    loc: 'contracts.md:22',
  },
  {
    id: 'V5',
    severity: 'advisory',
    source: 'critic',
    message: 'The tracker asks for a per-user limit as well; the package covers only the tenant',
    loc: 'research.md:64',
  },
  {
    id: 'V6',
    severity: 'advisory',
    source: 'critic',
    message: 'AC-2 and D-002 describe the same rejection in different words',
    loc: 'acceptance.md:28',
  },
];

export interface PackageFile {
  path: string;
  owner: 'researcher' | 'developer';
  bytes: number;
  placeholders?: number;
  body: string;
}

export const SAMPLE_PACKAGE_FILES: PackageFile[] = [
  {
    path: 'task.json',
    owner: 'researcher',
    bytes: 1_284,
    body: `{
  "schema_version": 1,
  "id": "CU-86c1abcd",
  "title": "Tenant-based daily API request quota",
  "version": 2,
  "status": "published",
  "roles": ["backend", "frontend"],
  "enforcement": "strict",
  "scope": {
    "backend": { "allow": ["app/quota/**", "tests/quota/**"], "deny": ["app/billing/**"] },
    "frontend": { "allow": ["src/features/quota/**"], "deny": [] }
  }
}`,
  },
  {
    path: 'research.md',
    owner: 'researcher',
    bytes: 8_912,
    body: `# Research

## Problem
Tenants can exhaust shared capacity; one noisy tenant degrades the API for every other.

## Current state, with citations
- Requests enter through \`app/api/middleware.py:31\`, which has no per-tenant counter.
- \`app/core/errors.py:74\` builds error responses and cannot set a header today.
- Billing already aggregates per UTC day: \`app/billing/aggregate.py:52\`.

## Approach
Count per tenant per UTC day in an atomic upsert, reject with 429, set Retry-After.

## Rejected alternatives
- A token bucket in memory: lost on deploy, and wrong behind two workers.
- Queueing over-quota requests: hides the limit, moves cost to latency (see D-002).`,
  },
  {
    path: 'scope.md',
    owner: 'researcher',
    bytes: 1_902,
    body: `# Scope

The backend owns \`app/quota/**\` and \`tests/quota/**\`.

\`app/billing/**\` is explicitly denied: the quota must not change how anything is billed,
and a change there would need its own task.`,
  },
  {
    path: 'acceptance.md',
    owner: 'researcher',
    bytes: 3_140,
    body: `## AC-1 [backend, frontend] Requests over the limit return 429 with Retry-After in seconds

Given a tenant that has used its daily quota
When another request arrives
Then the API answers 429 and sets Retry-After to the seconds until the next UTC midnight
Verification: pytest tests/quota/test_quota_exceeded.py

## AC-3 [backend] Repeated requests are idempotent

Given a request that carries an idempotency key
When it is replayed
Then the quota is charged once`,
  },
  {
    path: 'decisions.md',
    owner: 'researcher',
    bytes: 2_610,
    body: `## D-004 Retry-After is capped at 3600 seconds (v2, 2026-10-30)

Question: Q-001 — is Retry-After seconds or a date, and is it bounded?
Decision: Seconds, capped at 3600 even when the window is longer.
Rationale: Clients retry blindly after long values; an hour is long enough to shed load.
Impact: AC-1 keeps seconds; the cap is asserted in the test.`,
  },
  {
    path: 'contracts.md',
    owner: 'researcher',
    bytes: 1_440,
    placeholders: 1,
    body: `# Contracts

The backend returns 429 with \`Retry-After\` (seconds) and a body of
\`{"error": "quota_exceeded", "retry_after": <seconds>}\`.

The frontend shows the remaining quota from \`GET /v2/tenant/quota\`.

On 404 the frontend {{shows what?}} — this is the gap the critic flagged.`,
  },
  {
    path: 'roles/backend.md',
    owner: 'researcher',
    bytes: 2_180,
    body: `# backend

Your slice: the counter, the middleware and the error body.

Pitfalls
- \`ApiError\` cannot set headers yet (\`app/core/errors.py:74\`); it needs a small change.
- The counter must be an atomic upsert, not read-then-write.

Test expectation: a concurrency test that runs two requests against one tenant.`,
  },
  {
    path: 'roles/frontend.md',
    owner: 'researcher',
    bytes: 1_505,
    body: `# frontend

Your slice: the remaining-quota indicator and the 429 state.

Pitfalls
- Retry-After is seconds, not a date (D-004).`,
  },
  {
    path: 'plan.md',
    owner: 'developer',
    bytes: 1_920,
    body: `# Plan — CU-86c1abcd (backend)

- [x] 1. Add the per-tenant quota field and its migration (AC-4)
- [x] 2. Count requests in an atomic upsert (AC-2)
- [x] 3. Reject over-quota requests with 429 (AC-1)
- [x] 4. Set Retry-After in seconds, capped at 3600 (AC-1, D-004)
- [ ] 5. Charge the quota once for a replayed idempotency key (AC-3)
- [ ] 6. Expose the remaining quota on the tenant endpoint (AC-4)
- [ ] 7. Run the full suite and the scope audit (all)`,
  },
  {
    path: 'questions.md',
    owner: 'developer',
    bytes: 760,
    body: `## Q-001 Is Retry-After seconds or a date?

Status: ANSWERED (D-004)
Asked: 2026-10-30
Context: AC-1`,
  },
];

export const SAMPLE_VERIFY = {
  verdict: 'PARTIAL' as const,
  agent: 'wizrelay:test-engineer',
  suite: { command: 'pytest -q', output: '142 passed, 1 skipped in 18.42s', exitCode: 0 },
  notVerified: [
    {
      id: 'AC-3',
      why: 'No test in the repository proves idempotent charging.',
      suggestion: 'tests/quota/test_quota_idempotency.py',
    },
  ],
  rule: 'Everything covered passes, but AC-3 is NOT COVERED, so the result is capped at PARTIAL.',
  trackerComment: '[WIZRELAY-VERIFY] CU-86c1abcd — backend — PARTIAL',
};
