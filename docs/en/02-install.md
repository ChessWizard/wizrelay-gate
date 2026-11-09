<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/02-install.md)
<!-- /nav -->

# Install and run

New here? **[Setup, end to end](21-walkthrough.md)** walks the whole thing in order.

What you need, and the three commands that start it.

## Prerequisites

| | |
|---|---|
| **Node.js** | 20.9 or newer |
| **git** | for reading the hub and the project repositories |
| **Python 3.9+ and the `wizrelay` CLI** | optional, for running gates against real repositories |
| **Claude Code** | optional, for the conversational gates |

Without `wizrelay` and `claude` the dashboard still runs: gates play the bundled
transcript instead, and the board says so in a banner.

Prefer a container? [17. Running with Docker](17-docker.md) needs none of the above
except Docker itself.

## Install

```bash
npm install
```

## Run it

```bash
npm run dev
```

Then open <http://localhost:3100>. The first run opens the setup wizard.

## Build and start

```bash
npm run build
npm start
```

## Where it keeps its state

Everything lives in `.wizrelay-gate/` beside the project:

```
.wizrelay-gate/
├── workspace.json              # hub, repositories, appearance, language
├── relays/<id>.json            # one file per relay
└── events/<relay>__<role>__<gate>.jsonl   # the append-only gate console log
```

`WIZRELAY_GATE_HOME` moves that folder somewhere else. Deleting it resets the dashboard;
it never holds anything the hub or your repositories do not already have.

<!-- foot -->
← Previous: [Overview](01-overview.md) · [Documentation](README.md) · Next: [Setting up the panel](03-initialize.md) →
<!-- /foot -->
