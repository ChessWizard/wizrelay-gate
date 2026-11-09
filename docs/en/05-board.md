<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/05-board.md)
<!-- /nav -->

# The relay board

The screen the app opens to, and the one that answers "what needs me?" in under two seconds.

## Needs you

Every open gate prompt, oldest first, each with the relay, the gate, the question in one
line and a way in. This section sits above everything else and is the reason the app was
opened.

## The metrics

Three tiles — the numbers you act on today:

| Tile | Where the number comes from |
|---|---|
| **Needs you** | open gate prompts |
| **Gates failed** | gates whose verdict is `FAIL` |
| **Open questions** | `Q-nnn` entries with status `OPEN`, and the age of the oldest |

Under them, on one line, the numbers you read weekly rather than hourly: the PASS /
PARTIAL / FAIL split of finished verify gates, the guard events where an edit was denied,
and the median time a prompt waited for an answer.

There is no cost estimate, no productivity score and no team-wide analytics: there is no
server to aggregate them, and a number nobody can act on is noise.

## Workspace readiness

While anything is incomplete — no hub, no repository, a missing CLI — a checklist sits
above the relays with what is missing and a link to where it is fixed. Once everything is
ready it disappears from the board; it is always in
[Settings](12-settings.md).

## Search and the relay list

The box in the top bar (`⌘K`) opens **Relays**, the list of every task in the hub, and
types into the URL — so a search is a link you can send, and the back button works.

It used to narrow the board in place, which gave a search no page of its own: nothing to
narrow further, and nothing to show somebody else. The board is the pipeline; the relay
list is where you look things up.

Free text matches the relay id, its title, its tracker reference and its roles, folded for
Turkish — `isa` finds `İsa`. Terms narrow further and can be combined:

| Term | Keeps |
|---|---|
| `needs:me` | relays with an open prompt |
| `status:failed` | relays with a gate in that status — any gate, not just the current one |
| `role:backend` | relays that fan out to that role |
| `gate:verify` | relays that have that gate |

A word the list does not recognise stays free text rather than being dropped, so
`http://localhost:3100` searches for exactly that.

The filter rows on the relay list write the same terms into the same query, which is why
the chips and the box can never disagree. The board keeps its own three chips for the
things you filter it by every day.

Both lists show only the tasks you may see — see [Who sees what](20-access.md).

## The relay list

**Flow view** (the default): one card per relay. The nine gates are a line of stages —
a dot each, one word, the connector into a live stage animating — with the research track
on its own line and one line per role under it. A stage's result is its tooltip; the words
live in the gate's console, one click away.

**Table view**: one row per relay *and role*, for when you have more relays than fit on a
screen.

While anything is running the board refreshes itself every few seconds and says so with a
**Live** tag. An idle board makes no requests at all.

## Writing the package from the panel

A `.md` file in the package has an **Edit** view beside Read and Source: a plain
textarea, a Save and a Discard, and a chip that says when there are unsaved changes. It
writes the file on disk — the hub copy for the researcher's half, the repository copy for
the developer's. Publishing is still the publish gate; saving is just saving.

A textarea on purpose. This text goes into a Markdown file somebody else reads as
Markdown, and an editor that owns the text would quietly decide things about it.

Three things are refused, and the panel says which:

| Refused | Why |
|---|---|
| A path that leaves the package folder | `path` comes from the browser, and the panel runs as a user with a home directory and an SSH key |
| `task.json`, `.validation.md`, `.lock.json` | a tool writes these; editing one by hand makes the tooling disagree with its own output |
| The other half of the package | the researcher writes the research, the developer writes the plan, the questions and the verification |

Somebody who administers the panel may write either half.

### Editing with Claude

Under the file is a one-line instruction box — *give AC-3 a verification command* — which
starts the **research gate** with that file named and your instruction attached, and takes
you to its console.

It is the research gate rather than a second kind of session on purpose: the work then
happens under the same scope protection, the same approvals and the same transcript as
every other gate, instead of in a side channel nobody can audit.

<!-- foot -->
← Previous: [The nine task quality gates](04-gates.md) · [Documentation](README.md) · Next: [The run and its console](06-run-and-console.md) →
<!-- /foot -->
