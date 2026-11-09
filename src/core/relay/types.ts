import type { GateId, Persona, TrackId } from '@/core/gates/gates';
import type { Actor } from '@/core/identity/actor';
import type { CriterionResult, GateStatus, Verdict } from '@/core/status/status';
import type { Phase, PhaseSetting } from '@/core/routing/policy';
import type { RoutingDecision, Signals } from '@/core/routing/routing';

/** `task.json`, as the hub publishes it. */
export interface TaskPackage {
  schema_version: number;
  id: string;
  tracker: { type: string; ref: string; url?: string };
  title: string;
  slug: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
  roles: string[];
  repos?: Record<string, string>;
  enforcement: 'strict' | 'ask' | 'off';
  scope: Record<string, { allow: string[]; deny: string[] }>;
  routing: {
    signals: Signals;
    role_signals?: Record<string, Partial<Signals>>;
    overrides?: Record<string, Partial<Record<Phase, Partial<PhaseSetting>>>>;
  };
  changelog: { version: number; date: string; summary: string }[];
}

/** `.lock.json`, as `wizrelay pull` writes it in a developer repository. */
export interface LockFile {
  schema_version: number;
  task_id: string;
  tracker_ref: string;
  title: string;
  folder: string;
  version: number;
  hub_commit: string;
  pulled_at: string;
  role: string;
  files: Record<string, string>;
  routing: { tier: string; score: number; phases: Record<string, PhaseSetting>; launch: string };
}

export interface Check {
  id: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  /** `acceptance.md:42`, or the glob that matched. */
  loc?: string;
  command?: string;
  output?: string;
}

export interface Finding {
  id: string;
  severity: 'blocking' | 'advisory';
  source: 'validate' | 'critic';
  message: string;
  loc?: string;
}

export type PromptVariant = 'decision' | 'input' | 'approval' | 'scope' | 'attachment';

export interface PromptOption {
  id: string;
  label: string;
  meaning?: string;
  cost?: string;
  /** The answer that hands the question to the researcher instead. */
  handoff?: boolean;
}

export interface ApprovalPayload {
  /** The exact command that will run, shown in full. */
  command?: string;
  /** The exact text that will be posted, shown in full. */
  text?: string;
  target?: string;
  /** The word the person types to confirm an outward-facing action. */
  confirmWord?: string;
  /** 1 of 2, for the publish gate's two separate approvals. */
  step?: { index: number; total: number };
}

export interface ScopeContext {
  file: string;
  allow: string[];
  deny?: string[];
  pattern?: string;
  /** `deny` can never be allowed from here; `ask` can. */
  decision: 'deny' | 'ask';
}

export interface GatePrompt {
  id: string;
  gate: GateId;
  variant: PromptVariant;
  question: string;
  detail?: string;
  options?: PromptOption[];
  payload?: ApprovalPayload;
  scope?: ScopeContext;
  /** Where the answer will be written, for the input variant. */
  destination?: string;
  status: 'open' | 'answered' | 'stale';
  askedAt: string;
  answeredAt?: string;
  answer?: { optionId?: string; text?: string; by: 'you'; actor?: Actor };
  pinned?: boolean;
}

export interface Artifact {
  path: string;
  kind: 'file' | 'commit' | 'comment' | 'branch' | 'pull-request';
  owner?: 'researcher' | 'developer';
  summary?: string;
  url?: string;
}

export interface GuardEvent {
  at: string;
  decision: 'deny' | 'ask';
  file: string;
  /** The deny glob that matched, when there was one. */
  pattern?: string;
  allow?: string[];
  outcome?: 'refused' | 'allowed-once' | 'handed-off';
}

export interface AcceptanceCriterion {
  id: string;
  title: string;
  roles: string[];
  given?: string;
  when?: string;
  then?: string;
  verification?: string;
  result?: CriterionResult;
  evidence?: { command: string; output?: string };
}

export interface Question {
  id: string;
  title: string;
  status: 'OPEN' | 'ANSWERED' | 'CANCELLED';
  askedAt: string;
  blocks?: string;
  body?: string;
  role?: string;
  relayId: string;
  decisionId?: string;
  trackerComment?: string;
  /** Who raised it, as a handle — an address, or a bare name the panel does not know. */
  askedBy?: string;
  /**
   * Who it is for. Written as `Ask:` in the package or as `@` anywhere in the question,
   * and empty when nobody said — which is not "everybody" but "the research lead", since
   * an unaddressed question is still somebody's to answer.
   */
  askedOf?: string[];
}

export interface Decision {
  id: string;
  title: string;
  version: number;
  date: string;
  question?: string;
  decision?: string;
  rationale?: string;
  impact?: string;
}

export interface PlanStep {
  index: number;
  done: boolean;
  text: string;
  criterion?: string;
  files?: string[];
  test?: string;
}

export interface GateState {
  gate: GateId;
  status: GateStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  /** A one-line result, already in the user's words. */
  result?: string;
  /** A result the services layer cannot translate: the UI renders this key instead. */
  resultKey?: string;
  resultParams?: Record<string, string | number>;
  verdict?: Verdict;
  checks: Check[];
  findings?: Finding[];
  prompts: GatePrompt[];
  artifacts: Artifact[];
  guardEvents?: GuardEvent[];
  metrics?: Record<string, string | number>;
  /** The commands this run actually executed, with their exit codes. */
  commands?: { command: string; exitCode?: number }[];
  /**
   * When an earlier gate re-ran and this one's verdict stopped meaning anything.
   *
   * The hub scan reads a gate's status from the files a package holds, and those files
   * outlive the verdict about them: `.validation.md` is still on disk after the research
   * it validated has been rewritten. Without this, a reset gate looks to the scan like a
   * gate that simply has not run, and the scan's reading wins.
   */
  supersededAt?: string;
  /**
   * How far the gate's engine has run. The scripted engine resumes from here after a
   * prompt is answered, which is also what makes a gate survive a server restart.
   */
  cursor?: number;
  /**
   * Who started this run. There is no account system: the identity comes from the Claude
   * Code session or the git config on the machine that ran it (see the identity service).
   */
  actor?: Actor;
}

export interface Track {
  id: TrackId;
  /** Delivery and ship tracks belong to one role; the research track to none. */
  role?: string;
  repo?: string;
  gates: GateState[];
}

export interface Relay {
  id: string;
  title: string;
  slug: string;
  tracker: { type: string; ref: string; url?: string };
  version: number;
  packageStatus: TaskPackage['status'];
  roles: string[];
  repos: Record<string, string>;
  enforcement: TaskPackage['enforcement'];
  scope: Record<string, { allow: string[]; deny: string[] }>;
  /**
   * The routing signals the package declares, carried through from `task.json` so every
   * screen routes from the researcher's judgement rather than from a default.
   */
  routing?: TaskPackage['routing'];
  hub: { repo: string; commit?: string };
  /** The version published in the hub, when it is ahead of what a repo pulled. */
  hubVersion?: number;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
  questions: Question[];
  /** Set when scope protection was not active in the session that ran a gate. */
  guardInactive?: boolean;
  /**
   * The relay exists in this dashboard but not in the hub yet — an intake that has not
   * been published. It belongs on the board, labelled, rather than hidden.
   */
  localOnly?: boolean;
}

export interface RelaySummary {
  id: string;
  title: string;
  version: number;
  hubVersion?: number;
  tracker: Relay['tracker'];
  status: GateStatus;
  stage: TrackId;
  currentGate: GateId;
  roles: string[];
  updatedAt: string;
  research: GateState[];
  byRole: { role: string; repo?: string; gates: GateState[] }[];
  waiting: number;
  openQuestions: number;
  localOnly?: boolean;
}

export interface NeedsYouItem {
  relayId: string;
  relayTitle: string;
  role?: string;
  gate: GateId;
  owner: Persona;
  prompt: GatePrompt;
}

export interface RoutingView extends RoutingDecision {
  role: string;
  policySource: 'hub' | 'plugin-default';
}
