<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/01-overview.md)
<!-- /nav -->

# Overview

wizrelay-gate is a local-first dashboard that runs a wizrelay task as a pipeline of task quality gates.

[wizrelay](https://github.com/ChessWizard/wizrelay) is a Claude Code plugin. It carries a
researcher's task analysis from one team hub into every developer's AI coding session, and
it enforces that analysis deterministically: scope protection, model routing, a question
loop and an independent verification step. Everything it does is driven from slash
commands in a terminal.

wizrelay-gate is the other surface for the same work. It turns the flow into a pipeline
you can watch, answer and approve — the way CI/CD turned shell scripts into stages with
quality gates, logs and manual approvals.

## What it adds

| | |
|---|---|
| **A pipeline you can see** | Nine gates, from intake to ship, with the research track once and a delivery track per role |
| **A prompt that waits** | When Claude needs a decision, an approval or a file, the gate stops and the board says so |
| **The commands in the open** | Every deterministic result shows the command that produced it, so the UI and the CLI can never disagree |
| **Metrics that exist** | Time waiting on a human, open-question age, scope violations, verify verdicts — nothing invented |

## What it is not

- **Not a replacement for the CLI.** The plugin stays fully usable without this dashboard.
- **Not a service of ours.** No telemetry, and nothing is hosted for you: the panel is
  yours, on your laptop or on a box your team runs. Gates execute on the machine of
  whoever started them — through an agent that machine runs — so your code, your git
  credentials and your Claude session stay where they already are.
- **Not a second implementation.** Scope decisions, validation and routing come from the
  `wizrelay` CLI; the dashboard renders what the CLI answers.

## Two ways to run it

**Sample workspace** — seven relays, every gate state, nothing on your disk is touched.
This is what you get if you pick "Explore the sample workspace instead" during setup.

**Connected** — a real hub repository and one or more project repositories. Gates run the
real commands, and the conversational gates run a headless Claude Code session when
`claude` is on your PATH.

<!-- foot -->
[Documentation](README.md) · Next: [Install and run](02-install.md) →
<!-- /foot -->
