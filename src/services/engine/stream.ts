import type { GateId } from '@/core/gates/gates';
import type { GateEvent, LiveFrame } from '@/core/relay/events';
import { streamKey } from '@/core/relay/events';
import { history, subscribe, subscribeLive } from './runner';

/**
 * The gate console's byte stream.
 *
 * Replay first, then live: the caller passes the last sequence number it saw, receives
 * everything after it from the append-only log, and is then subscribed. A one-second tail
 * of the same log backs the subscription up, so a console can never sit silent while the
 * gate is moving.
 *
 * Two kinds of frame travel here. The default ones are the record and carry a sequence
 * number a reconnecting console resumes from. The ones named `live` are the session
 * typing: no sequence number, never replayed, and gone the moment the finished message
 * takes their place. That split is why a console can show every token without the gate's
 * log growing a row per token.
 *
 * Server-sent events rather than a socket, deliberately. This stream only ever goes one
 * way, it reconnects by itself, it survives every proxy, and it needs no second server
 * beside the panel — a WebSocket would buy nothing here and cost all three.
 */
export interface StreamOptions {
  relayId: string;
  role?: string;
  gate: GateId;
  from: number;
  signal: AbortSignal;
}

export function gateEventStream(options: StreamOptions): ReadableStream<Uint8Array> {
  const { relayId, role, gate, from, signal } = options;
  const encoder = new TextEncoder();
  const key = streamKey(relayId, role, gate);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let highest = from;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: GateEvent) => {
        if (event.seq <= highest) return;
        highest = event.seq;
        write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const sendLive = (frame: LiveFrame) => {
        write(`event: live\ndata: ${JSON.stringify(frame)}\n\n`);
      };

      for (const event of await history(relayId, role, gate, from)) send(event);

      const unsubscribe = subscribe(key, send);
      const unsubscribeLive = subscribeLive(key, sendLive);
      const tail = setInterval(() => {
        if (closed) return;
        void history(relayId, role, gate, highest).then((events) => events.forEach(send));
      }, 1_000);
      const keepAlive = setInterval(() => write(': keep-alive\n\n'), 15_000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(tail);
        clearInterval(keepAlive);
        unsubscribe();
        unsubscribeLive();
        try {
          controller.close();
        } catch {
        }
      };

      signal.addEventListener('abort', close);
    },
  });
}

export const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
} as const;
