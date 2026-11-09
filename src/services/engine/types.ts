import type { Locale } from '@/shared/i18n/config';
import type { GateId } from '@/core/gates/gates';
import type { GateEvent, GateEventBody, LiveFrame } from '@/core/relay/events';
import type { GatePrompt } from '@/core/relay/types';
import type { Verdict } from '@/core/status/status';
import type { Executor } from '@/services/shell/executor';

export interface PromptAnswer {
  promptId: string;
  optionId?: string;
  text?: string;
  files?: { name: string; size: number }[];
}

export interface EngineContext {
  relayId: string;
  role?: string;
  gate: GateId;
  /** The working copy this gate belongs to — the repository, or the hub for research. */
  cwd?: string;
  /**
   * Both checkouts, because one gate can touch both: publish commits in the hub, pull
   * reads from it and writes in the repository. A step says which one it needs.
   */
  hubCwd?: string;
  /** Checkouts this machine offers for reading, so a session can cite the code. */
  readDirs?: string[];
  /** The language the person who started this gate reads the console in. */
  locale?: Locale;
  repoCwd?: string;
  /** Run only this step of the gate, when the person asked for one rather than all. */
  only?: string;
  mode: 'demo' | 'live';
  /**
   * What runs the commands. The panel's own machine when somebody runs the panel on their
   * laptop, and the agent on the person's machine when the panel lives on a server. Every
   * engine goes through this rather than spawning, which is the whole reason a gate can
   * run somewhere the panel cannot see.
   */
  exec: Executor;
  /** The machine's name, when the work left the panel. */
  machine?: string;
  /**
   * Who pressed the button. Only used to look up their own approval rule: a commit asks
   * the person whose name it will carry, or does not ask because that person said so.
   */
  userId?: string | null;
  /** A message the person typed to start this turn. */
  message?: string;
  /**
   * What the person added when the gate asked, before the session started.
   *
   * Separate from `message` because a conversational gate's prompt is the skill it
   * invokes — `/wizrelay:plan` — and a note that replaced it would run a bare question
   * instead of the command, which is exactly what happened the first time this was tried.
   */
  notes?: string;
  /** Where to resume — the scripted engine's step index. */
  cursor: number;
  emit(body: GateEventBody): Promise<GateEvent>;
  /**
   * Show something without recording it: a token as it arrives, a tool as it starts.
   * Synchronous and cheap on purpose — it is called hundreds of times per answer, and
   * anything that touched the disk here would make a fast session feel like a slow one.
   */
  live(frame: LiveFrame): void;
  /** Persist the cursor so a restart resumes in the right place. */
  saveCursor(cursor: number): Promise<void>;
  /** Blocks until the person answers, or the run is stopped. */
  ask(prompt: GatePrompt): Promise<PromptAnswer | null>;
  stopped(): boolean;
  sleep(ms: number): Promise<void>;
}

export interface EngineResult {
  verdict?: Verdict;
  summary?: string;
  /** True when the gate paused on a prompt rather than finishing. */
  paused?: boolean;
}

export interface Engine {
  readonly name: 'scripted' | 'claude' | 'steps';
  run(context: EngineContext): Promise<EngineResult>;
}
