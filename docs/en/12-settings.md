<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/12-settings.md)
<!-- /nav -->

# Settings, connections and privacy

## Your password

Settings → **Your password**. You need your current one to change it: the session already
proves who you are, but an unlocked screen should not be enough to lock you out of your
own account.

At least 12 characters, with letters and digits. Changing it ends every other session you
have and leaves the one you are using alone.

Nobody can change it for you. An owner or an admin can only issue a fresh invitation
link, which ends your old password and any open session — visible as exactly what it is.

The first owner starts with `OWNER_PASSWORD` from the environment. Until that person
picks their own, the panel says so here and keeps an item open in the setup list.

## Workspace

The hub (link, branch, local working copy, tracker, role catalogue, last fetch) and the
connected repositories with their role, stack and test command.

## Routing policy

A read-only view of the effective policy and where it came from — the plugin default or
the hub's `policies/routing-policy.json`. It is edited in the hub, because that is where
the team's policy belongs.

## Appearance

The design direction (Control Room or Studio), the theme (light, dark or system) and the
language. All three are stored in the workspace file, so the server renders the right one
on the first paint and there is no flash.

## Notifications

A desktop notification when a gate needs you, when a question is answered, or when CI
finishes. Only the first is on by default.

## Diagnostics

`git`, `python3`, `wizrelay` and `claude` on PATH, plus `wizrelay doctor` when the CLI is
installed. The report copies as plain text.

## Approving a commit or a push

The panel asks before a commit or a push. Those two leave the machine and carry your
name, so the default is always to ask.

Somebody answering the same question for the fifth time is not consenting, they are
clicking. Beside the answer is **Stop asking me this**: on **this task**, or on **all my
tasks**. What you switch off is yours alone — nobody can switch it off for you, and you
cannot switch off anybody else's question. Commits and pushes are separate.

When it is off the step still runs, and the console records it: *"ran without asking, by
your setting"*. "You approved this" and "your setting approved this" are different facts,
and six weeks later only the transcript tells them apart. Everything you switched off is
listed on this page and goes back with one click.

## Connections

Your own ClickUp and GitHub, connected here with a personal token. The panel acts as you
when it reads a task, lists your repositories, reads the hub or looks up a pull request.

A token is encrypted with the server key the moment it is saved and is never shown again —
the field shows whether one is connected, not what it is. Remove it and the panel falls
back to a shared `GITHUB_TOKEN` or `CLICKUP_API_TOKEN` in the environment, if the
installation has one.

Nothing is connected for you by somebody else. A panel that acted as you with a token you
did not provide would be a panel you could not account for.

### Making the GitHub token

**github.com → your avatar → Settings → Developer settings → Personal access tokens.**
There are two kinds, and the fine-grained one is the better answer.

**Fine-grained token** (*Fine-grained tokens → Generate new token*):

| Field | What to choose |
|---|---|
| **Resource owner** | Your own account, or the organisation the hub and the project repositories belong to. |
| **Repository access** | *Only select repositories* — the hub, plus every repository you will register as a project. *All repositories* also works and is less to maintain. |
| **Repository permissions → Contents** | **Read-only.** This is the one that matters: it reads the hub and the project repositories. |
| **Repository permissions → Metadata** | **Read-only.** GitHub selects it for you and will not let you clear it. |
| **Repository permissions → Pull requests** | **Read-only**, so the panel can show the pull requests open on a relay. Leave it off and everything else still works. |
| **Expiration** | Your call. When it expires the panel says so by name rather than claiming GitHub is not connected. |

Nothing else. No write permission, no account permissions, no workflow scope. The panel
never pushes with this token — commits and branches happen on your own machine, with your
own git identity.

**Classic token** (*Tokens (classic) → Generate new token*): tick **`repo`** and nothing
else. `repo` is coarse — it grants write as well as read — which is exactly why the
fine-grained token is preferred. For hubs and repositories that are all public,
`public_repo` is enough.

### If the organisation owns the repositories

Two things catch people out, and both produce a token that looks fine and sees nothing:

1. The organisation must **allow fine-grained personal access tokens** (*Organisation
   settings → Personal access tokens*). If it does not, use a classic token with `repo`,
   authorised for the organisation through SSO.
2. A fine-grained token against an organisation may need an **owner to approve it** before
   it works. Until then it is issued and refused.

The panel now reports which of these happened: an expired or revoked token, a token
without the permission, a token that sees no repositories, and a GitHub it could not
reach are four different messages rather than one.

### If the organisation blocks personal access tokens

Many organisations restrict fine-grained tokens, and some refuse them outright. Work down
this list; the first one that applies is your answer.

**1 · A classic token, authorised for the organisation.** This is the usual way through,
because the restriction above is specifically about *fine-grained* tokens.

*Settings → Developer settings → Tokens (classic) → Generate new token (classic)* → tick
**`repo`** → generate. Then, still on the token list, find the token and use
**Configure SSO → Authorize** next to the organisation. Without that step the token is
issued, looks perfect, and sees none of the organisation's repositories.

If there is no *Configure SSO* link, the organisation does not use SAML and the token
works as soon as you are a member with read access.

**2 · Ask an owner to open the door.** One setting, once, for everybody:
*Organisation settings → Third-party Access → Personal access tokens → Settings*. Three
choices — allow, require approval, restrict. **Require approval** is the sensible middle:
tokens work, and an owner sees each one first. If it is already on *require approval*,
your token exists and is waiting; an owner approves it under *Pending requests*.

**3 · Your own SSH key, with the panel on your own machine.** Everything the panel does
with git — reading the hub — works over SSH with the key you already push with. The
repository list and the branch dropdown are the parts that need the API; without a token
you type the address instead, which the form offers.

This is enough for a single-person install. It is not enough for a panel on a server,
which has no key of its own.

**4 · A read-only account for the panel.** An account added to the organisation with read
access to the hub and the project repositories, with its own classic token, set as
`GITHUB_TOKEN` in the environment. Everyone who has not connected their own token falls
back to it.

Treat this as the last option. Every action it takes is attributed to that account rather
than to a person, which is exactly what this panel is built to avoid.

### What still works without any token

More than you would expect, because the panel asks GitHub for convenience rather than for
correctness:

| Works | Needs a token |
|---|---|
| Reading a public hub, and a private one over SSH on your own machine | Reading a private hub on a server |
| Adding a project by typing its address | The repository list to pick from |
| Typing a branch name | The branch dropdown |
| Every gate, every package, every question | The pull requests shown beside a relay |

The panel never pushes with your token. Commits and branches happen on your own machine,
with your own git identity, whatever is connected here.

## Privacy

Nothing leaves this machine except to the git remote and the tracker you configured
yourself. There is no account, no server and no telemetry. The dashboard stores its own
state in `.wizrelay-gate/`, and deleting that folder resets it.

Tracker and package content is treated as **data, never as instructions** — if a task
description contains something addressed to an assistant, it is shown quoted, not acted
on.

<!-- foot -->
← Previous: [The question loop](11-questions.md) · [Documentation](README.md) · Next: [How the code is organised](13-architecture.md) →
<!-- /foot -->
