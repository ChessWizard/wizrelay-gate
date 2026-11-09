<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/21-walkthrough.md)
<!-- /nav -->

# Setup, end to end

Every step from an empty machine to a working panel, in order. Each heading is done once;
you do not come back to it.

If something stops you, read the **"When it goes wrong"** box under that step — every one
of them is something that actually happened.

---

## 0 · Decide first: where do gates run

This decides everything below it.

| Option | What it means | Who it suits |
|---|---|---|
| **agent** (recommended) | The panel runs nothing. Everybody runs an agent on their own machine, and a gate runs in their checkout, with their git identity and their Claude session. | A team |
| **local** | The panel runs gates on its own machine. | One person |
| **auto** (default) | A paired machine when there is one, this machine otherwise. | Trying it out |

For a team panel choose `agent`: no repository, no SSH key and no Claude session is kept
on the server, and nothing is committed on anybody else's behalf.

---

## 1 · Start the panel

One container is the whole installation; the image carries its own PostgreSQL.

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 \
  -v wizrelay-gate-data:/data \
  -e OWNER_EMAIL=you@company.com \
  -e OWNER_PASSWORD='a-long-password' \
  -e WIZRELAY_GATE_EXECUTION=agent \
  wizrelay/gate:beta
```

Open `http://localhost:3100` and sign in with `OWNER_EMAIL`. That account is the panel's
only owner.

Without `AUTH_SECRET` the container generates one onto the volume, so sessions survive a
restart. Set `DATABASE_URL` to use your own PostgreSQL and the built-in one never starts.
Details: [Running on a server](17-docker.md).

> **When it goes wrong.** `docker logs wizrelay-gate` — the first boot prepares the
> database, and the healthcheck allows 60 seconds for it. `/api/health` reports the
> database, the signing secret, and whether `git`, `python3`, `wizrelay` and `claude` were
> found.

---

## 2 · Make your GitHub token

The panel acts **as you** when it lists your repositories, reads the hub or looks up a
pull request. The token is personal; it is encrypted with the server key and never shown
again.

**github.com → your avatar → Settings → Developer settings → Personal access tokens**

### Fine-grained token (preferred)

*Fine-grained tokens → Generate new token*

| Field | Choose |
|---|---|
| **Resource owner** | The account or organisation that owns the hub and the project repositories |
| **Repository access** | *Only select repositories* → the hub, plus every repository you will register |
| **Contents** | **Read-only** — reads the hub and the project repositories |
| **Metadata** | **Read-only** — GitHub selects it and will not let you clear it |
| **Pull requests** | **Read-only** — to show PRs beside a relay; may be left off |

Nothing else. No write, no workflow, no account permissions. **The panel never pushes with
this token** — commits and branches happen on your machine, with your git identity.

### Classic token

*Tokens (classic) → Generate new token (classic)* → tick **`repo`** only.

If the organisation uses SAML, find the token in the list and use
**Configure SSO → Authorize**. Skip that and the token is issued, looks perfect, and sees
none of the organisation's repositories.

> **When it goes wrong.** If the organisation blocks fine-grained tokens, either an owner
> opens them under *Organisation settings → Third-party Access → Personal access tokens*,
> or you use a classic token authorised through SSO. A fine-grained token awaiting an
> owner's approval exists and is refused — wait for the approval rather than making
> another. The panel names which of these happened. In full:
> [Settings and connections](12-settings.md).

### Enter it

**Settings → Connections → GitHub** → paste → Connect.

The card lists the permissions it needs. Connect **ClickUp** in the same place
(*app.clickup.com → Settings → Apps → API Token*): the panel reads the task, leaves
questions as card comments and brings the replies back.

---

## 3 · Connect the hub

**Administration → Hubs → Add hub** → the hub repository's address.

The panel reads `wizrelay-hub.json` for the hub's name, tracker and role catalogue. A URL
with credentials in it is refused.

On the same screen:

- **Branch** — the branch packages are read from. Normally `main` or `master`.
- **Tracker** and **Task id prefix** — `clickup` and `CU-`, for example.
- **A checkout on this machine** — fill this in only when the panel and a real checkout
  are the same computer.

> **When it goes wrong.** Left empty, the panel clones its own **read mirror**. The mirror
> is reset with `git reset --hard` on every refresh, so gates that **write** to the hub
> will not run against it and the panel refuses them by name. On a team panel that is
> correct: writing happens on a person's own machine.

---

## 4 · Add the projects

Each hub role is one repository. **Administration → Hubs → Repository**.

The repositories your GitHub token can see are listed; search, pick one, give it a role.
The panel clones nothing — it records the repository, and the machine that runs the gate
already has it.

If the list does not come, **Enter the repository by hand** takes a clone address, which
is checked before it is kept.

The role comes from the repository's own `.wizrelay/config.json` when it has one. Give
each project a **research lead**: unaddressed questions fall to them.

---

## 5 · Invite people

**Administration → People → Create an invitation**

The address, the panel role and the **per-project** roles are set in one step:

- **Researcher** — runs the research gates, writes the package
- **Developer** — builds the plan, runs the delivery gates

Somebody may hold both. Nothing ticked means no access to that project, which is often the
right answer. The panel produces an invitation link; you send it, it works once, and the
person sets their own password.

The whole access rule: [Who sees what](20-access.md).

---

## 6 · Everybody connects their own machine

Each person does this **on their own machine**.

### 6.1 · Download the agent and pair

In the panel: **Settings → Connections → Machines → Get a pairing code**. Eight
characters, one use, short-lived.

```bash
curl -fsSL https://panel.company.com/agent -o /tmp/wizrelay-agent.mjs
node /tmp/wizrelay-agent.mjs pair ABCD-2345 --panel https://panel.company.com
```

The panel issues a **machine token**; the agent writes it to
`~/.wizrelay-gate/agent.json` and copies itself to
`~/.wizrelay-gate/wizrelay-agent.mjs`. That token means something only between the panel
and your machine — it never reaches Claude, GitHub or ClickUp.

### 6.2 · Declare the working copies

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/research-hub --role hub
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/api --role api
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/web
```

Without `--role` it is read from the repository's own `.wizrelay/config.json`.
**`hub` is a special name**: every research gate runs inside the hub checkout, so this
line is required if you will do research.

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs repos
```

### 6.3 · Run the agent

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs run
```

It lists every folder and waits for work. It should appear online on the **Machines** card.

> **When it goes wrong.**
>
> **"outside every folder this machine offers"** — the agent re-reads its folders on every
> job, but a version **older than 1.1.0** reads them once at startup. And if more than one
> agent is running, whichever asks first takes the job — an older one then refuses it.
> Since 1.2.0 a second copy cannot start; check with `ps aux | grep wizrelay-agent`.
>
> **`check.binaryMissing`** — the agent is started from a terminal but outlives it: it
> does not get the PATH your shell builds, and Claude Code puts `wizrelay` only on the
> PATH of its own tools. Pin it:
> ```bash
> node ~/.wizrelay-gate/wizrelay-agent.mjs use wizrelay ~/.claude/plugins/cache/wizrelay/wizrelay/<version>/bin/wizrelay
> node ~/.wizrelay-gate/wizrelay-agent.mjs status
> ```
> Refresh that path after upgrading the plugin.

### 6.4 · Check the wizrelay CLI

```bash
which -a wizrelay
```

**More than one result is a problem.** `wizrelay` is both a Claude Code plugin and a
pip-installable package, and the pip distribution carries only the library — the tracker
catalogue and the templates are left behind. When that copy comes first, gates fail deep
inside the tool:

```
Unknown tracker type 'clickup'.
  Fix: Use one of: none.
```

Nothing is wrong with the hub's tracker setting.

```bash
pip uninstall wizrelay       # the plugin provides the CLI
```

### 6.5 · Allow Claude's tools

Gates run `claude` **on your machine, as you**. The panel never reaches your Claude
account; it reads the email in `~/.claude.json` only to stamp the run with a person.

A headless session cannot ask for permission, so a refused tool stays refused in silence.
Grant them permanently in `~/.claude/settings.json` so the research gate can read the
tracker task:

```json
{
  "permissions": {
    "allow": [
      "mcp__claude_ai_ClickUp__clickup_get_task",
      "mcp__claude_ai_ClickUp__clickup_get_task_comments"
    ]
  }
}
```

---

## 7 · Run the first task

**Relays → New relay**: the tracker reference, a title, the roles.

Then, in order: **Intake → Research → Validate → Publish**. One gate at a time, or the
whole track at once.

Intake opens a branch named after the task (`research/<id>-<slug>`) and writes the package
onto it. Publish pushes to that branch; the package reaches the hub's main branch at
delivery, with your approval.

From the package page (`/package/<id>`) you can read the files, change one by hand with
**Edit**, or hand it to Claude with a one-line instruction.

> **When it goes wrong.** A gate waits for the one before it and says so. Re-run an
> earlier gate and every gate after it is reset — their verdicts were about work that no
> longer exists. See [The nine gates](04-gates.md).

---

## Checklist

- [ ] The panel is up and `/api/health` sees all four tools
- [ ] GitHub and ClickUp are connected **for each person**
- [ ] The hub is connected, with the right branch and tracker
- [ ] Every hub role has a repository and a research lead
- [ ] People are invited and have their project roles
- [ ] Every machine is paired, declares its copies including `hub`, and is running
- [ ] `which -a wizrelay` gives exactly one result
- [ ] Claude's tool permissions are granted permanently

<!-- foot -->
← Previous: [Who sees what](20-access.md) · [Documentation](README.md)
<!-- /foot -->
