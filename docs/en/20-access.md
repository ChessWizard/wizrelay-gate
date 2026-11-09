<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/20-access.md)
<!-- /nav -->

# Who sees what

A panel that everybody can see everything in is not a shared panel, it is a shared
folder. This page is the whole rule, in one place, so you can check it rather than
discover it.

## The two questions

Access answers two different questions and it is worth keeping them apart.

**What may I reach** is membership: the hubs, projects, tasks and packages that belong to
work you are part of. **What may I change** is role: who may add a hub, who may run a
delivery gate, who may invite somebody.

Membership is the one that decides whether a thing appears at all.

## Membership

A person is a member of a **project** — one repository playing one hub role — and they
hold one or both project roles in it: researcher, developer. An owner or an admin grants
this, either in the invitation or later on the person's page.

Everything below follows from that single fact.

| What | Who sees it |
|---|---|
| A hub | Anybody who is a member of at least one of its projects. An admin sees every hub. |
| A project | Its members. An admin sees every project. |
| A task (relay) | Anybody who is a member of a project whose hub role the task names. |
| A research package | The same people as its task. |
| A question | Its addressee, and whoever asked it. See below. |
| Activity | Your own, unless you administer the panel. |

A task you may not see does not appear on the board, is not in the relay list, is not in
a search, and its own address answers as though it does not exist — because whether a
task exists is itself something only its team should learn.

The console stream is held to the same rule, which it was not: anything reachable over
HTTP asks who is asking before it answers, and a request with no session gets a 401
rather than a page.

## Questions

A question has an addressee, and only its addressee sees it. The asker keeps sight of
their own question, and whoever administers the panel sees all of them.

The addressee comes from the question itself. `Ask:` in `questions.md` names one or
several, separated by commas; writing `@somebody` anywhere in the question does the same.
A question that names nobody falls to the project's **research lead**, which is set per
project and starts as the owner.

A question in a project with no research lead is addressed to nobody, and the panel says
so on the card rather than filing it where only an admin will ever look.

## Roles

**Panel roles** are about the panel. **Project roles** are about one repository. See
[People, roles and activity](18-activity.md) for the table of each.

The two combine in the obvious way: an admin reaches every project without being a member
of any, and a member reaches only what their memberships cover, whatever their project
roles say.

## What this does not do

It is not a secrets boundary. Everybody who can sign in shares one panel, one database and
one set of hub clones, and an administrator can read anything. If two groups must not be
able to read each other's code at all, run two panels.

Tokens are the exception and are treated as one: each person's ClickUp and GitHub tokens
are encrypted with the server key, are never shown again after they are entered, and are
used only to act as that person.

<!-- foot -->
← Previous: [Running on your own machine](19-agent.md) · [Documentation](README.md) · Next: [Setup, end to end](21-walkthrough.md) →
<!-- /foot -->
