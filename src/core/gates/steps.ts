import { hubTaskBranch } from './branches';
import type { GateId } from './gates';
import { GATES } from './gates';

/**
 * What a gate actually does, step by step.
 *
 * `GateDefinition.commands` is documentation — `wizrelay pull <ref>` with the angle
 * brackets a person reads. This turns that into the commands that will really run, with
 * the relay's own values in them, so the console can execute a gate instead of describing
 * one. Every command here was checked against `wizrelay --help` for the installed version;
 * nothing is invented, and a subcommand the CLI does not have never appears.
 *
 * The planner is pure: it decides *what* would run. Running it, and refusing to run the
 * outward-facing ones without a yes, is the engine's job.
 */

export type StepKind = 'command' | 'conversation' | 'manual';

/** Where the step runs. The hub and the project repository are different checkouts. */
export type StepWhere = 'hub' | 'repo';

/** Only these two binaries are ever planned; the engine allowlists them again. */
export type StepBinary = 'wizrelay' | 'git';

/**
 * An outward-facing step: it leaves the machine or rewrites history, so it is never run
 * without an explicit yes, and the approval names what the person is agreeing to.
 */
export type StepApproval = 'commit' | 'push' | null;

export interface GateStep {
  id: string;
  gate: GateId;
  kind: StepKind;
  where: StepWhere;
  /** The catalogue key for the one-line description. */
  labelKey: string;
  /** The command as a person would type it — also what the console prints. */
  command: string;
  binary?: StepBinary;
  args?: string[];
  approval: StepApproval;
  /**
   * A value the step needs that nobody has supplied yet.
   *
   * `notes` is the only optional one: it is the chance to say something before a session
   * starts rather than a value the command cannot run without, so an empty answer carries
   * on instead of skipping the step.
   */
  needs?: 'summary' | 'message' | 'notes';
  /** True when the step only reads: safe to re-run at any time. */
  readOnly: boolean;
}

export interface StepContext {
  relayId: string;
  title: string;
  roles: string[];
  role?: string;
  /** The package folder name, `<id>-<slug>`. */
  folder: string;
  /** The hub's default branch. */
  hubBranch: string;
  /** The delivery branch, when one is known. */
  branch?: string;
  /** What the repository diffs against, `origin/main` or whatever it configured. */
  base?: string;
  /** Supplied by an input prompt before the publish gate's first step may run. */
  summary?: string;
  /** Supplied by an input prompt before the ship gate may commit. */
  message?: string;
}

/**
 * Quote an argument for display only.
 *
 * The command string is what the console prints; what actually runs is the `args` array,
 * passed to `spawn` with no shell, so nothing here can change the meaning of a command.
 * The point is that the printed line is one a person could paste — which means not
 * quoting the characters a shell leaves alone, such as the comma in a role list.
 */
function quote(value: string): string {
  if (value === '') return '""';
  return /[^A-Za-z0-9_.,:/@+=-]/.test(value) ? `"${value.replace(/(["\\$`])/g, '\\$1')}"` : value;
}

function command(binary: StepBinary, args: string[]): string {
  return [binary, ...args.map(quote)].join(' ');
}

interface Draft {
  kind?: StepKind;
  where: StepWhere;
  labelKey: string;
  binary?: StepBinary;
  args?: string[];
  approval?: StepApproval;
  needs?: GateStep['needs'];
  readOnly?: boolean;
  /** For a conversation or a manual step, which has no command of its own. */
  text?: string;
}

function build(gate: GateId, drafts: Draft[]): GateStep[] {
  return drafts.map((draft, index) => ({
    id: `${gate}.${index + 1}`,
    gate,
    kind: draft.kind ?? 'command',
    where: draft.where,
    labelKey: draft.labelKey,
    command: draft.binary && draft.args ? command(draft.binary, draft.args) : (draft.text ?? ''),
    binary: draft.binary,
    args: draft.args,
    approval: draft.approval ?? null,
    needs: draft.needs,
    readOnly: draft.readOnly ?? false,
  }));
}

export function planGate(gate: GateId, context: StepContext): GateStep[] {
  const { relayId, title, roles, folder, hubBranch } = context;
  const branch = context.branch ?? `wizrelay/${relayId}`;
  const hubTask = hubTaskBranch(folder);
  const base = context.base ?? 'origin/main';

  switch (gate) {
    case 'intake':
      return build(gate, [
        {
          where: 'hub',
          labelKey: 'step.intake.branch',
          binary: 'git',
          args: ['checkout', '-B', hubTask],
        },
        {
          where: 'hub',
          labelKey: 'step.intake.new',
          binary: 'wizrelay',
          args: ['hub', 'new', relayId, '--title', title, '--roles', roles.join(',')],
        },
      ]);

    case 'research':
      return build(gate, [
        { kind: 'conversation', where: 'hub', labelKey: 'step.research.write' },
        {
          where: 'hub',
          labelKey: 'step.research.check',
          binary: 'wizrelay',
          args: ['hub', 'validate', relayId],
          readOnly: true,
        },
      ]);

    case 'validate':
      // The critic, not a second structural check. `/wizrelay:hub-validate` runs
      // `wizrelay hub validate` itself and then reviews the package against the tracker
      // task — testability, contradictions, coverage, uncited claims. That review is the
      // reason this gate exists, and it was the part the panel never ran.
      return build(gate, [
        { kind: 'conversation', where: 'hub', labelKey: 'step.validate.review' },
      ]);

    case 'publish':
      return build(gate, [
        {
          where: 'hub',
          labelKey: 'step.publish.prep',
          binary: 'wizrelay',
          args: ['hub', 'publish-prep', relayId, '--summary', context.summary ?? ''],
          needs: context.summary ? undefined : 'summary',
        },
        {
          where: 'hub',
          labelKey: 'step.publish.stage',
          binary: 'git',
          args: ['add', `tasks/${folder}`],
        },
        {
          where: 'hub',
          labelKey: 'step.publish.commit',
          binary: 'git',
          args: ['commit', '-m', `publish ${relayId}: ${context.summary ?? title}`],
          approval: 'commit',
        },
        {
          where: 'hub',
          labelKey: 'step.publish.push',
          binary: 'git',
          args: ['push', '-u', 'origin', hubTask],
          approval: 'push',
        },
        {
          where: 'hub',
          labelKey: 'step.publish.comment',
          binary: 'wizrelay',
          args: ['hub', 'comment', relayId],
          readOnly: true,
        },
      ]);

    case 'pull':
      return build(gate, [
        {
          where: 'repo',
          labelKey: 'step.pull.download',
          binary: 'wizrelay',
          args: ['pull', relayId],
        },
        {
          where: 'repo',
          labelKey: 'step.pull.activate',
          binary: 'wizrelay',
          args: ['activate', folder],
        },
        {
          where: 'repo',
          labelKey: 'step.pull.status',
          binary: 'wizrelay',
          args: ['status', '--json'],
          readOnly: true,
        },
      ]);

    case 'plan':
      return build(gate, [
        {
          where: 'repo',
          labelKey: 'step.plan.brief',
          binary: 'wizrelay',
          args: ['brief', '--phase', 'plan'],
          readOnly: true,
        },

        {
          kind: 'conversation',
          where: 'repo',
          labelKey: 'step.plan.write',
          needs: 'notes',
        },
      ]);

    case 'implement':
      return build(gate, [
        {
          where: 'repo',
          labelKey: 'step.implement.brief',
          binary: 'wizrelay',
          args: ['brief', '--phase', 'implement'],
          readOnly: true,
        },
        { kind: 'conversation', where: 'repo', labelKey: 'step.implement.work' },
        {
          where: 'repo',
          labelKey: 'step.implement.audit',
          binary: 'wizrelay',
          args: ['audit', '--no-fail', '--format', 'json'],
          readOnly: true,
        },
      ]);

    case 'verify':
      return build(gate, [
        {
          where: 'repo',
          labelKey: 'step.verify.brief',
          binary: 'wizrelay',
          args: ['brief', '--phase', 'verify'],
          readOnly: true,
        },
        { kind: 'conversation', where: 'repo', labelKey: 'step.verify.check' },
        {
          where: 'repo',
          labelKey: 'step.verify.audit',
          binary: 'wizrelay',
          args: ['audit', '--no-fail', '--format', 'md'],
          readOnly: true,
        },
      ]);

    case 'ship':
      return build(gate, [
        {
          where: 'repo',
          labelKey: 'step.ship.branch',
          binary: 'git',
          args: ['checkout', '-B', branch],
          approval: 'commit',
        },
        {
          where: 'repo',
          labelKey: 'step.ship.commit',
          binary: 'git',
          args: ['commit', '-am', context.message ?? `${relayId}: ${title}`],
          approval: 'commit',
          needs: context.message ? undefined : 'message',
        },
        {
          where: 'repo',
          labelKey: 'step.ship.push',
          binary: 'git',
          args: ['push', '-u', 'origin', branch],
          approval: 'push',
        },
        {
          where: 'repo',
          labelKey: 'step.ship.audit',
          binary: 'wizrelay',
          args: ['audit', '--branch', branch, '--base', base, '--no-fail', '--format', 'json'],
          readOnly: true,
        },
        {
          where: 'hub',
          labelKey: 'step.ship.hubRelease',
          binary: 'git',
          args: ['push', 'origin', `${hubTask}:${hubBranch}`],
          approval: 'push',
        },
      ]);

    default:
      return [];
  }
}

/** The gates of one track, in the order a run would walk them. */
export function trackGates(track: 'research' | 'delivery'): GateId[] {
  return (Object.keys(GATES) as GateId[])
    .filter((id) => GATES[id].track === track)
    .sort((left, right) => GATES[left].index - GATES[right].index);
}

/** Whether a gate can run unattended in a chain: nothing to approve, nothing to supply. */
export function runsUnattended(steps: GateStep[]): boolean {
  return steps.every((step) => step.approval === null && !step.needs && step.kind !== 'manual');
}
