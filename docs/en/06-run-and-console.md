<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/06-run-and-console.md)
<!-- /nav -->

# The run and its console

The relay run screen is where a single task is watched; the console is where it is talked to.

## The run screen

- **The header** carries the title, the research version, the tracker link and the exact
  launch command this task's routing produced.
- **The tracks** are two cards: the research track and the delivery track. Each carries its
  own name, what it runs against, and the button that runs it — the research track names
  the hub, the delivery track the project the work lands in and the role it plays in the
  hub's catalogue. When no repository is connected for that role the project badge says so
  and links to where one is connected.
- **The question loop** sits under the tracks whenever a question is open.
- **The gate pane** opens on **Checks** — the deterministic assertions, each with the file,
  the glob or the command that produced it. Console, Artifacts and Metrics are tabs.
- **The context column** holds the scope, the acceptance criteria, the routing summary and
  the open questions.

A gate that cannot start yet says which gate it is waiting for. A gate that is waiting for
you shows its prompt above the tabs, not hidden in a log.

## The console

A job log you can talk to:

- Claude's prose, with tool calls collapsed to one line each and thinking behind a toggle
- commands with their exit code and output
- diffs, marked as proposed when they have not been written
- guard events: an `ask` becomes a prompt, a `deny` becomes an information card that
  cannot be overridden here
- an open prompt pinned to the bottom until it is answered

The composer sends a message, offers the slash commands, and accepts an attachment up to
5 MB. The model and effort for this phase are shown next to Send, with a warning when the
session is running below the tier routing recommends.

## Following the gate that is running

There is a switch in the header: **Following**. While it is on, the panel moves to the
console of whichever gate starts running. It is on by default; watching a nine-gate track
otherwise means noticing that a dot changed colour and clicking across.

It can be turned off, because following is wrong exactly when somebody is reading
something. The choice is kept in that browser only. Only a **running** gate is followed:
one waiting for an answer will not drag you away from whatever you opened to answer it
with.

When a gate starts waiting, a notice lands in the inbox — which task, which question, and
a link to the console that is asking. It is deduplicated per task.

## How the transcript reads

A turn opens with who is speaking — **You** or **Claude** — and consecutive messages are
grouped into one turn rather than stamped with a name each.

Claude's answer is drawn as a **document**, not as an unbroken block: headings, lists,
tables and fenced code with its language. The reader is the panel's own and never emits
HTML, which matters because this text comes from a model and goes straight to a screen.

Tool calls are one scannable line — what ran, and where. Commands carry their exit code.
Lines the session writes to stderr are drawn amber when they are warnings and red when
they are faults; a note like "8 permissions entries ignored" should not make a healthy run
look broken.

The prompt appears **once**. The command line shows `…` where the prompt would be, because
the prompt is the line directly above it; in the same way the session's closing `result`
line repeats the last answer, so it is only printed when there was no other answer.

## What the session looks like while it runs

A conversational gate opens `claude -p --output-format stream-json
--include-partial-messages` on your machine, and everything the session says about itself
reaches the console.

Measured on Claude Code 2.1.311 on 2026-11-08, a turn that calls two tools:

```
  1592ms  running the hooks       ← the plugin's own SessionStart hook
  7920ms  starting the session
  7920ms  asking the model
  9086ms  running Read            ← about four seconds before the message carrying it
 13565ms  thinking                ← the tool returned, the model is asked again
 26773ms  asking the model
 29756ms  the answer
```

The bottom line of the console says which phase it is in and how long that phase has been
running. A long silence now reads as "thinking · 11s" rather than as a page that might be
broken.

**Token streaming.** Answer text is typed out as it arrives, with a caret. What the
measurement shows: in turns that call tools the events spread across the whole run, but a
single block of answer text usually arrives at once — in `-p` mode Claude Code produces it
in one piece. So letter-by-letter typing is not always visible; **the phases always are**,
and they are what answer the real question.

**Shown and recorded are different things.** Tokens and phase lines travel on the live
channel only: never written to disk, never folded into the relay, never replayed on
reload. The durable transcript is what it always was — messages, tool calls, commands,
checks. Missing a token costs a few characters; recording one would turn a transcript into
a keystroke log.

**Why not a WebSocket.** This stream only goes one way, server to browser. Server-sent
events do exactly that, reconnect by themselves, survive every proxy, and need no second
server beside the panel. A socket would buy nothing here and cost all three.

**Cost.** Measured: a gate run makes about **seven HTTP requests**, opens one database row
per flush, and deletes all of them when the job finishes. Rows left behind after the
measurement: none.

## How the stream works

The console subscribes to `/api/relays/<id>/gates/<gate>/stream`. It passes the last
sequence number it saw; the server replays everything after it from the append-only log
and then streams live. A reconnect therefore loses nothing, and the console says which
state it is in: connecting, streaming, paused, stalled, reconnected or offline.

<!-- foot -->
← Previous: [The relay board](05-board.md) · [Documentation](README.md) · Next: [Gate prompts and approvals](07-prompts.md) →
<!-- /foot -->
