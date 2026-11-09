<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/11-questions.md)
<!-- /nav -->

# The question loop

The one flow that crosses two people, and the one the dashboard measures honestly.

```
Developer    /wizrelay:ask  →  Q-001 OPEN in questions.md  →  a comment on the card
Researcher   hub-inbox  →  a decision  →  D-004 in decisions.md  →  research v2 published
Developer    sync  →  the diff  →  plan steps marked  →  Q-001 ANSWERED (D-004)
```

## A question is addressed to somebody

Every question has an addressee, and only its addressee sees it. The person who asked
keeps sight of their own, and whoever administers the panel sees all of them.

This is the part that was missing. Every question used to appear on everyone's screen,
which sounds open and is the opposite: a list where most items are somebody else's is a
list nobody reads, and the question that was actually blocking a task sat in it for days.

Three ways to say who it is for, and they are the same mechanism:

```markdown
## Q-012 Which cache strategy?

Status: OPEN
Asked: 2026-11-08
Asked by: @isa@example.com
Ask: @ayse@example.com, @mert
Context: AC-3
```

- **`Ask:`** (`Kime:` in a Turkish hub) names one or several, separated by commas.
- **`@somebody`** anywhere in the question's title or body does exactly the same.
- **Nobody named** — it falls to the project's **research lead**, set per project.

A question in a project with no research lead is addressed to nobody. The panel says so
on the card, rather than filing it where only an admin will look.

## Naming somebody while you type

`@` in the console composer offers the people a mention can name: everybody who can sign
in here, and everybody in the connected tracker workspace. The second group matters more
than it looks — the person who knows why a contract is shaped the way it is often has no
account on this panel, and a question for them has to be addressable before it can be
routed anywhere.

Pick with the arrow keys and Enter, or keep typing. What is inserted is an address,
because that is unique and it is what the routing compares.

## Asking on the card

**Ask on the tracker** leaves the question as a comment on the task's card, addressed to
its addressee and assigned to them where the tracker knows them by the same address.

The comment carries its own identity — `[wizrelay Q-012]` on the first line — which is
how the panel later tells its own comment from an answer to it. Replies come back on the
card and appear under the question here, so the person who asked reads the answer without
leaving the panel.

A reply is any comment that names the question. People answer by quoting `Q-012`; asking
them to use a particular syntax is asking them not to answer.

## What the screen shows

- **Mine** — the questions you raised and are waiting on.
- **Inbox** — the questions waiting on your answer.
- the question, who asked it, who it is for, and which acceptance criterion it blocks
- **how long it has been waiting** — the metric nobody tracks and everybody feels
- the replies that came back from the card
- once answered, the decision beside the question that caused it, with the version that
  carried it

On the run screen the loop is drawn as seven stops: asked, written to the package, posted
to the tracker, answer, decision, new research version, pulled into the repository. Each
stop carries its own state, and every one of them is read from the same place — the
package on disk. Nothing is guessed: a stop whose tracker comment never existed shows as
skipped, and a decision that is not in `decisions.md` leaves its stop empty.

## Why it is a loop and not a chat

An answer given only as a tracker comment is invisible to the next session that reads the
package, and to every other developer. The loop ends in `decisions.md` and a version bump,
which is what the next `pull` or `sync` carries. The panel says as much under a reply:
once it is answered, pull the package to bring the research up to date.

See [Who sees what](20-access.md) for the rest of the access rules.

<!-- foot -->
← Previous: [The verification report](10-verify.md) · [Documentation](README.md) · Next: [Settings, connections and privacy](12-settings.md) →
<!-- /foot -->
