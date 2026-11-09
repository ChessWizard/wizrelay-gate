'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GateId } from '@/core/gates/gates';
import type { GateEvent, LiveFrame } from '@/core/relay/events';
import type { GatePrompt } from '@/core/relay/types';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import type { MentionCandidate } from '@/shared/ui/mention-box';
import { MentionBox } from '@/shared/ui/mention-box';
import { Icon } from '@/shared/ui/icons';
import { Banner, Button, Grow, LinkButton } from '@/shared/ui/primitives';
import { runGate } from '@/features/gate-prompts/actions';
import { PromptCard } from '@/features/gate-prompts/components/prompt-card';
import { ConsoleMessage } from './console-message';

type Connection = 'connecting' | 'streaming' | 'waiting' | 'stalled' | 'reconnected' | 'offline';

const SLASH_COMMANDS = [
  { command: '/wizrelay:ask', description: 'Open a question for the researcher instead of guessing' },
  { command: '/wizrelay:plan', description: 'Re-plan against the acceptance criteria' },
  { command: '/wizrelay:verify', description: 'Hand off to the independent verifier' },
  { command: '/wizrelay:sync', description: 'Pull the newest research version and diff it' },
];

const STALL_MS = 45_000;

/**
 * How much of a live answer is kept on screen before the finished message replaces it.
 *
 * The buffer is React state and it is rewritten on every token, so an unbounded one would
 * make a long answer slower to render the longer it got. The tail is what somebody is
 * reading anyway, and nothing is lost: the whole message lands a moment later as a
 * recorded event.
 */
const LIVE_TAIL = 4_000;

interface Live {
  channel: 'text' | 'thinking';
  text: string;
}

/** What the session says it is doing: a tool it started, or a word about itself. */
type Working = ({ kind: 'tool'; name: string } | { kind: 'status'; status: string }) & {
  /** When this phase began, so the line can count. */
  since: number;
};

/** The statuses worth a sentence; anything else is shown in the session's own word. */
const KNOWN_STATUS = new Set(['hooks', 'starting', 'requesting', 'thinking', 'compacting']);

export interface ConsoleStreamProps {
  relayId: string;
  role?: string;
  gate: GateId;
  initial: GateEvent[];
  /**
   * A prompt the gate is already waiting on, from the stored gate state. A prompt can
   * outlive the stream it was asked in — a restart, or a gate seeded from a scan — and it
   * must still be answerable, so it is pinned from here when the stream has none.
   */
  initialPrompt?: GatePrompt | null;
  engineLabel: string;
  modelLine: string;
  belowTier: boolean;
  /** Who an `@` can name: everybody here, and everybody in the connected tracker. */
  people: MentionCandidate[];
  /** Where the console closes to, so leaving does not mean scrolling to the top first. */
  closeHref: string;
}

/**
 * The live console.
 *
 * Replay then subscribe, so a reconnect loses nothing; an open prompt is pinned to the
 * bottom so the person never has to scroll to find what is blocking them.
 *
 * Closing is offered twice, at the top of the console and beside the composer. That is
 * not a duplicate: a session running all afternoon puts its own header far above the only
 * part anybody is still looking at, and reaching it meant scrolling against a page that
 * scrolls itself.
 */
export function ConsoleStream({
  relayId,
  role,
  gate,
  initial,
  initialPrompt,
  engineLabel,
  modelLine,
  belowTier,
  people,
  closeHref,
}: ConsoleStreamProps) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [events, setEvents] = useState<GateEvent[]>(initial);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [showTools, setShowTools] = useState(true);
  const [draft, setDraft] = useState('');
  const [palette, setPalette] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  /** What the session is typing right now, and what it says it is doing. */
  const [live, setLive] = useState<Live | null>(null);
  const [working, setWorking] = useState<Working | null>(null);
  /**
   * A clock, so a phase that lasts seven seconds does not read as a phase that stopped.
   * It ticks only while something is running, which is the only time anyone is looking,
   * and the elapsed figure is derived from it rather than read during render.
   */
  const [now, setNow] = useState(() => Date.now());

  const bottom = useRef<HTMLDivElement | null>(null);
  const lastSeq = useRef(initial.reduce((highest, event) => Math.max(highest, event.seq), 0));
  /** When the last event arrived; 0 until the first one, which is how a stall is judged. */
  const lastAt = useRef(0);

  const openPrompt = useMemo<GatePrompt | null>(() => {
    const answered = new Set(
      events.filter((event) => event.body.kind === 'prompt-answered').map((event) =>
        event.body.kind === 'prompt-answered' ? event.body.promptId : '',
      ),
    );
    const prompts = events
      .filter((event) => event.body.kind === 'prompt')
      .map((event) => (event.body.kind === 'prompt' ? event.body.prompt : null))
      .filter((prompt): prompt is GatePrompt => prompt !== null)
      .filter((prompt) => !answered.has(prompt.id));
    if (prompts.length > 0) return prompts[prompts.length - 1];
    return initialPrompt && !answered.has(initialPrompt.id) ? initialPrompt : null;
  }, [events, initialPrompt]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const open = () => {
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      params.set('from', String(lastSeq.current));
      source = new EventSource(
        `/api/relays/${encodeURIComponent(relayId)}/gates/${gate}/stream?${params.toString()}`,
      );

      source.onopen = () => {
        setConnection((previous) => (previous === 'offline' ? 'reconnected' : 'streaming'));
      };

      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as GateEvent;
          lastSeq.current = Math.max(lastSeq.current, event.seq);
          lastAt.current = Date.now();
          setEvents((previous) =>
            previous.some((candidate) => candidate.seq === event.seq) ? previous : [...previous, event],
          );

          if (event.body.kind === 'message' || event.body.kind === 'thinking') setLive(null);
          if (event.body.kind === 'prompt') setConnection('waiting');
          else if (event.body.kind === 'done') {
            setLive(null);
            setWorking(null);
            setConnection('streaming');
            router.refresh();
          } else setConnection((previous) => (previous === 'waiting' ? previous : 'streaming'));
        } catch {
        }
      };

      source.addEventListener('live', (message) => {
        try {
          const frame = JSON.parse((message as MessageEvent<string>).data) as LiveFrame;
          lastAt.current = Date.now();
          if (frame.kind === 'delta') {
            setLive((previous) =>
              previous && previous.channel === frame.channel
                ? { channel: frame.channel, text: (previous.text + frame.text).slice(-LIVE_TAIL) }
                : { channel: frame.channel, text: frame.text.slice(-LIVE_TAIL) },
            );
            setWorking(null);
          } else if (frame.kind === 'block-end') {
            setLive(null);
          } else if (frame.kind === 'tool-start') {
            setLive(null);
            setWorking({ kind: 'tool', name: frame.name, since: Date.now() });
          } else if (frame.kind === 'working') {
            setWorking((previous) =>
              previous?.kind === 'status' && previous.status === frame.status
                ? previous
                : { kind: 'status', status: frame.status, since: Date.now() },
            );
          }
        } catch {
        }
      });

      source.onerror = () => {
        setConnection('offline');
        source?.close();
        if (!closed) retry = setTimeout(open, 2_000);
      };
    };

    open();

    return () => {
      closed = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [gate, relayId, role, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (connection !== 'streaming') return;
      if (lastAt.current > 0 && Date.now() - lastAt.current > STALL_MS) setConnection('stalled');
    }, 5_000);
    return () => clearInterval(timer);
  }, [connection]);

  useEffect(() => {
    if (!working) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [working]);

  /**
   * Following the output, until somebody stops it.
   *
   * Scrolling to the latest line on every event is right while you are reading the latest
   * line and wrong the moment you are not: scroll up to re-read a command and the next
   * token drags you back down. Worse, a long session put every control out of reach,
   * because reaching one meant scrolling against a page that scrolls itself.
   *
   * So following is a state, left as soon as you scroll away from the bottom and rejoined
   * when you return to it — or when you press the button that says so.
   */
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!following) return;
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [events.length, live?.text, working, following]);

  useEffect(() => {
    const onScroll = () => {
      const fromBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      setFollowing(fromBottom < 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const connectionChip = {
    connecting: ['s-running', 'running', t('console.stream.connecting')],
    streaming: ['s-running', 'running', t('console.stream.streaming')],
    waiting: ['s-waiting', 'waiting', t('console.stream.waiting')],
    stalled: ['s-warned', 'warned', t('console.stream.stalled')],
    reconnected: ['s-passed', 'passed', t('console.stream.reconnected')],
    offline: ['s-failed', 'failed', t('console.stream.offline')],
  }[connection] as [string, 'running' | 'waiting' | 'warned' | 'passed' | 'failed', string];

  const send = () => {
    const message = draft.trim();
    if (!message) return;
    setDraft('');
    setPalette(false);
    start(async () => {
      await runGate({ relayId, role, gate, message });
      router.refresh();
    });
  };

  return (
    <section className="run-console console" aria-label={t('console.title', { gate: gate.toUpperCase() })}>
      <div className="console-h">
        <Icon name="terminal" />
        <span className="strong">{t('console.title', { gate: `GATE.${gate.toUpperCase()}` })}</span>
        <span className={cn('chip', connectionChip[0])}>
          <Icon name={connectionChip[1]} />
          {connectionChip[2]}
        </span>
        <span className="mono xs t3">{engineLabel}</span>
        <Grow />
        <Button
          size="sm"
          variant="ghost"
          icon="filter"
          aria-pressed={!showTools}
          onClick={() => setShowTools((value) => !value)}
        >
          {showTools ? t('console.hideTools') : t('console.showTools')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="copy"
          onClick={() => {
            const text = events
              .map((event) =>
                event.body.kind === 'message'
                  ? `${event.body.who === 'user' ? '>' : 'claude:'} ${event.body.text}`
                  : event.body.kind === 'command'
                    ? `$ ${event.body.command}`
                    : '',
              )
              .filter(Boolean)
              .join('\n');
            void navigator.clipboard.writeText(text);
          }}
        >
          {t('console.copyTranscript')}
        </Button>
        <LinkButton href={closeHref} size="sm" icon="close">
          {t('run.collapseConsole')}
        </LinkButton>
      </div>

      {connection === 'stalled' ? (
        <Banner tone="warn" inline body={t('console.stalledBody')} />
      ) : null}
      {connection === 'reconnected' ? (
        <Banner tone="success" inline body={t('console.reconnectedBody')} />
      ) : null}
      {connection === 'offline' ? (
        <Banner tone="error" inline body={t('console.offlineBody')} />
      ) : null}

      <div className="stream" role="log" aria-live="polite" aria-label={t('console.title', { gate })}>
        {events.length === 0 ? <span className="sm t3">{t('console.empty')}</span> : null}
        {events.map((event, index) => {
          const before = events[index - 1];
          const grouped =
            event.body.kind === 'message' &&
            before?.body.kind === 'message' &&
            before.body.who === event.body.who;
          return (
            <div key={event.seq} id={event.body.kind === 'prompt' ? `prompt-${event.seq}` : undefined}>
              <ConsoleMessage event={event} showTools={showTools} grouped={grouped} />
            </div>
          );
        })}

        {live ? (
          <div className="msg turn">
            <span className="who">{live.channel === 'thinking' ? '' : t('console.claude')}</span>
            <div className="turn-col">
              <span className="turn-name">
                {live.channel === 'thinking' ? t('console.thinkingLive') : t('console.nameClaude')}
              </span>
              <div className={cn('body', 'live-body', live.channel === 'thinking' && 'is-thinking')}>
                {live.text}
                <span className="live-caret" aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : null}

        {working ? (
          <div className="msg">
            <span className="who" />
            <span className="live-working">
              <span className="live-dot" aria-hidden="true" />
              {working.kind === 'tool'
                ? t('console.runningTool', { name: working.name })
                : KNOWN_STATUS.has(working.status)
                  ? t(`console.status.${working.status}` as 'console.status.requesting')
                  : working.status}
              <span className="mono t3">
                {t('console.elapsed', {
                  seconds: Math.max(0, Math.round((now - working.since) / 1_000)),
                })}
              </span>
            </span>
          </div>
        ) : null}

        <div ref={bottom} />
      </div>

      <div className="composer">
        {openPrompt ? (
          <PromptCard
            relayId={relayId}
            role={role}
            gate={gate}
            prompt={openPrompt}
            pinned
            anchor="#prompt-asked"
          />
        ) : null}

        {palette ? (
          <div className="palette-pop" role="listbox" aria-label={t('console.commands')}>
            {SLASH_COMMANDS.filter((item) => item.command.startsWith(draft.trim()) || draft.trim() === '/').map(
              (item, index) => (
                <button
                  key={item.command}
                  type="button"
                  className={cn('it', index === 0 && 'is-on')}
                  role="option"
                  aria-selected={index === 0}
                  onClick={() => {
                    setDraft(item.command);
                    setPalette(false);
                  }}
                >
                  <span className="c">{item.command}</span>
                  <span className="d">{item.description}</span>
                </button>
              ),
            )}
          </div>
        ) : null}

        {rejected ? (
          <div
            className="drop is-reject"
            style={{ flexDirection: 'row', justifyContent: 'flex-start', padding: '10px 12px' }}
          >
            <Icon name="failed" className="ink-failed" />
            <span className="sm">{rejected}</span>
          </div>
        ) : null}

        {!following ? (
          <button
            type="button"
            className="follow-again"
            onClick={() => {
              setFollowing(true);
              bottom.current?.scrollIntoView({ block: 'end' });
            }}
          >
            <Icon name="chevronDown" />
            {t('console.jumpLatest')}
          </button>
        ) : null}

        <div className="box">
          <label className="sr" htmlFor="composer">
            {t('console.messageLabel')}
          </label>
          <MentionBox
            id="composer"
            rows={2}
            placeholder={t('console.placeholder')}
            value={draft}
            people={people}
            onChange={(next) => {
              setDraft(next);
              setPalette(next.trimStart().startsWith('/'));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="row wrap" style={{ gap: '8px' }}>
            <label className="btn btn-sm btn-ghost" htmlFor="attach">
              <Icon name="attach" />
              {t('console.attach')}
              <input
                id="attach"
                type="file"
                className="sr"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setRejected(
                      t('console.attachmentRejected', {
                        name: file.name,
                        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                      }),
                    );
                    event.target.value = '';
                    return;
                  }
                  setRejected(null);
                  setDraft((value) => `${value}\n[${file.name}]`.trim());
                }}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={() => setPalette((value) => !value)}>
              {t('console.commands')}
            </Button>
            <LinkButton href={closeHref} size="sm" variant="ghost" icon="close">
              {t('run.collapseConsole')}
            </LinkButton>
            <Grow />
            <span className={cn('row xs', belowTier ? 'ink-warned' : 't3')} style={{ gap: '6px' }}>
              <Icon name={belowTier ? 'warned' : 'cpu'} />
              <span className="mono">{modelLine}</span>
            </span>
            <Button size="sm" variant="primary" disabled={pending || draft.trim() === ''} onClick={send}>
              {t('console.send')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
