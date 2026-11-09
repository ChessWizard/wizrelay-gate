<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/19-agent.md)
<!-- /nav -->

# Running on your own machine

The panel sits on a server; the commands run on your machine.

The panel has two shapes. Run it on your own laptop and it *is* the machine: the
repositories are there, your git identity is there, your Claude session is there. Move it
to a box the team shares and none of that is there — and moving it would mean handing one
server everybody's credentials.

So a shared panel runs nothing. It **asks**. A small agent runs on your machine, dials out
to the panel, and when a job addressed to you arrives it runs it in your checkout with
your tools and sends the output back. The team watches everyone's progress in the panel;
the code never reaches anyone's server.

## Three properties, on purpose

- **The agent dials out.** Nothing listens on your machine and no port is opened, so it
  works from behind NAT, a VPN or a corporate firewall.
- **The allowlist is enforced where the command runs**, not only where it is planned. A
  panel somebody has tampered with still cannot make your machine run `curl`.
- **A job names a folder the agent declared itself.** The panel cannot reach outside the
  folders you chose.

## Setting it up

### 1 — Pair the machine

Get the agent from the panel itself. There is no npm package and there should not be one:
a published agent would drift from the panel it talks to, and every install would have to
care which version each machine happened to have. Downloading it from the panel makes the
two the same version by construction.

```
curl -fsSL https://panel.example.com/agent -o /tmp/wizrelay-agent.mjs
```

Then, in the panel, the avatar at the top right → **Connections** → **This machine** →
**Pair a machine**. An eight-character code appears; ten minutes, single use.

```
node /tmp/wizrelay-agent.mjs pair ABCD-2345 --panel https://panel.example.com
```

On a successful pair the agent copies itself to `~/.wizrelay-gate/wizrelay-agent.mjs`, so
every command after this one has a single stable path. The download can be deleted.

The code buys a token. The token lives in `~/.wizrelay-gate/agent.json` with mode 600; the
panel keeps only its HMAC, so it cannot be read back. Lose it and you pair again.

### 2 — Offer your working copies

Once per role. A repository that has seen `wizrelay init` names its own role:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/web
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/api --role api
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/research-hub --role hub
```

Research gates run in the copy offered as `hub`; delivery gates run in the copy for their
role. Nothing runs in a folder you did not offer.

### 3 — Leave the agent running

```
node ~/.wizrelay-gate/wizrelay-agent.mjs run
```

It prints every command before it runs it, so you never have to look elsewhere to see what
your machine did.

```
14:13:28 run git rev-parse --abbrev-ref HEAD  in ~/Repos/web
14:13:28 ok 1s
14:13:32 refused git log -1  in /etc — outside every folder this machine offers: /etc
```

`--dry-run` starts nothing and reports every job as refused, which is how you try the
protocol without letting it touch anything.

## Which program the agent runs

The agent is started from a terminal but outlives it, and it does not get the PATH your
shell builds for you: no nvm, no pyenv, no direnv. Worse, PATH can resolve a name to the
**wrong copy**.

A real example: `wizrelay` is both a Claude Code plugin and a pip-installable package. If
the pip install comes first on PATH it shadows the plugin's complete installation with an
incomplete one, and the gate fails deep inside the tool with a message about its own
internals:

```
wizrelay pull CU-86c1abcd
The template directory is missing from this installation.
```

`status` says which copy is in use:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs status
```

```
  wizrelay   found /Library/Frameworks/Python.framework/Versions/3.12/bin/wizrelay
  git        found /opt/homebrew/bin/git
```

Pin the right one:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs use wizrelay ~/.claude/plugins/cache/wizrelay/wizrelay/0.1.0/bin/wizrelay
```

```
  wizrelay   found ~/.claude/plugins/cache/wizrelay/wizrelay/0.1.0/bin/wizrelay (pinned)
```

`use wizrelay auto` removes the pin. If a pinned path disappears the agent says so and
refuses to run that program rather than quietly falling back to the copy on PATH — the
person pinned their way out of that copy on purpose.

The machine card in the panel also shows which tools the machine found.

## The same trap on the panel's machine

Everything above is about a person's own machine, but the panel runs gates itself whenever
no paired machine holds the checkout a gate needs — and its PATH can resolve `wizrelay` to
the same incomplete pip copy. There it shows up as a tracker that is suddenly unknown:

```
wizrelay hub new CU-7fd2e914 --title "…" --roles api
Unknown tracker type 'clickup'.
  Why: No descriptor for it was found in the tracker catalogue.
  Fix: Use one of: none.
```

Nothing is wrong with the hub's tracker setting. The copy being run has no catalogue at
all, so the only tracker it can offer is the built-in `none`. Newer versions of the CLI say
that outright instead of blaming the setting.

Two ways out, and the first is better:

```bash
pip uninstall wizrelay          # the plugin provides the CLI; the pip copy is not needed
```

```bash
WIZRELAY_BIN=~/.claude/plugins/cache/wizrelay/wizrelay/<version>/bin/wizrelay   # pin it
```

`WIZRELAY_BIN`, `GIT_BIN`, `CLAUDE_BIN` and `PYTHON3_BIN` pin the panel's programs the way
`use` pins the agent's. A pin that does not resolve is reported as the program being
missing rather than quietly falling back to the copy you pinned your way out of.

## The same trap on the panel's machine

Everything above is about a person's own machine, but the panel runs gates itself whenever
no paired machine holds the checkout a gate needs — and its PATH can resolve `wizrelay` to
the same incomplete pip copy. There it shows up as a tracker that is suddenly unknown:

```
wizrelay hub new CU-7fd2e914 --title "…" --roles api
Unknown tracker type 'clickup'.
  Why: No descriptor for it was found in the tracker catalogue.
  Fix: Use one of: none.
```

Nothing is wrong with the hub's tracker setting. The copy being run has no catalogue at
all, so the only tracker it can offer is the built-in `none`. Newer versions of the CLI say
that outright instead of blaming the setting.

Two ways out, and the first is better:

```bash
pip uninstall wizrelay
```

```bash
WIZRELAY_BIN=~/.claude/plugins/cache/wizrelay/wizrelay/<version>/bin/wizrelay
```

`WIZRELAY_BIN`, `GIT_BIN`, `CLAUDE_BIN` and `PYTHON3_BIN` pin the panel's programs the way
`use` pins the agent's. A pin that does not resolve is reported as the program being
missing rather than quietly falling back to the copy you pinned your way out of.

## Which machine the panel picks

A gate you start runs on **your** machine. Not on the server, and not on a colleague's. If
you have several machines, the one that is online and has that role's working copy wins —
backend on the laptop and frontend on the desktop sorts itself out.

Everything a gate needs in order to run is on the **This machine** screen: the working
copies you offer, the tools that were found, the Claude account you are signed in to. When
the button is grey it is one of those three, and the screen says which.

## Signing in to Claude

The agent reads `~/.claude.json` on your machine and tells the panel which account it is
signed in to. Runs are stamped with that account, so the panel records a run as yours
rather than as the server's. No Claude credential is kept on the server, and none needs to
be: the session is already open on your machine.

If `claude` is not on your PATH the conversational gates fall back to the bundled
transcript, and the console says so in as many words.

## For the operator

```
WIZRELAY_GATE_EXECUTION=agent
```

`auto`, the default, sends work to a paired machine when there is one and to the panel's
own machine otherwise — which is right for a single-person install. On a shared panel set
`agent`: that machine has nobody's repositories, and a missing agent should say so rather
than quietly running here. `docker-compose.yml` already sets it.

`WIZRELAY_GATE_URL` fixes the address agents dial; left empty, the panel uses whatever
address the page was opened on.

## The protocol

| Endpoint | What it does |
|---|---|
| `POST /api/agent/pair` | Turns a code into a token. The only endpoint that needs no token, and the only one that issues one. |
| `POST /api/agent/hello` | Heartbeat and inventory: working copies, tools, Claude account. |
| `GET /api/agent/jobs` | A long poll; it waits twenty-five seconds and returns the moment there is work. |
| `POST /api/agent/jobs/:id` | Lines and the result. Every line carries its own sequence number. |

The contract lives in `src/core/agent/protocol.ts`; the agent's copy of the allowlists is
held to it by `tests/agent-protocol.test.ts`, which fails if the two ever drift.

## Troubleshooting

**"You have no paired machine online"** — the agent is not running, or cannot reach the
panel. `node ~/.wizrelay-gate/wizrelay-agent.mjs status` says what it can see.

**"None of your online machines has a working copy for this role"** — offer that role's
repository with `add`. The role names come from the hub's `wizrelay-hub.json`.

**A gate fails inside the tool itself** (`template directory is missing`, `command not
found`, an unexpected version) — the agent may be running the wrong copy. `status` says
which path it used; `use <program> <path>` pins the right one.

**The agent gets a 401** — the machine was removed from the panel. Pair it again with a
new code.

**The agent gets a 409** — the panel speaks a newer protocol than your agent. Update it.

## The hub the panel reads, and the hub a gate writes

The panel keeps a shallow clone of the hub so it can read packages without anybody's
checkout. That clone is a **mirror**: it is refreshed with `git fetch` and
`git reset --hard`, so anything written into it is gone at the next refresh.

So a gate that writes to the hub — intake, research, validate, publish — will not run
against the mirror. It refuses before it starts and says what to do:

> This gate writes to the hub, and the only hub copy on this machine is the panel's read
> mirror. Register the hub repository on your own machine with `--role hub`.

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/your-research-hub --role hub
```

Before this was enforced, such a gate ran against the mirror and looked like it had
worked: the console reported the branch created, the person's own checkout stayed on
`master`, and the work was one cache refresh from being erased.

A hub registered in Administration with a local path is a real checkout, not a mirror,
and writes to it are fine.

<!-- foot -->
← Previous: [People, roles and activity](18-activity.md) · [Documentation](README.md) · Next: [Who sees what](20-access.md) →
<!-- /foot -->
