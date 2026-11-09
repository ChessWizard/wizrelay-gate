<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/04-gates.md)
<!-- /nav -->

# The nine task quality gates

A relay is one task flowing end to end. A gate is the unit of progress.

```
TRACK: RESEARCH  (hub, researcher)
  G1 INTAKE ──► G2 RESEARCH ──► G3 VALIDATE ──► G4 PUBLISH
                                                   │  fan-out per role
TRACK: DELIVERY  (one per role)
  G5 PULL ──► G6 PLAN ──► G7 IMPLEMENT ──► G8 VERIFY ──► G9 SHIP

LANE: the question loop — can suspend Implement and reopen Publish
```

| Gate | Owner | What it runs | What it writes |
|---|---|---|---|
| **Intake** | Researcher | `wizrelay hub new <ref> --roles …` | the package skeleton, as a draft |
| **Research** | Researcher + Claude | conversation, attachments | `research.md`, `scope.md`, `acceptance.md`, `decisions.md`, `contracts.md`, `roles/<role>.md` |
| **Validate** | Researcher | `wizrelay hub validate <ref>` + a critic with no write access | `.validation.md`, which never leaves the hub |
| **Publish** | Researcher | `hub publish-prep`, `git commit`, `git push`, a tracker comment | version + 1, `published`, a changelog line |
| **Pull** | Developer | `wizrelay pull <ref>` | the read-only package copy and `.lock.json` |
| **Plan** | Developer + Claude | `/wizrelay:plan` | `plan.md`, one `- [ ]` step per unit of work |
| **Implement** | Developer + Claude | `/wizrelay:implement`, with the plugin's hooks enforcing scope | code, and the plan's checkboxes |
| **Verify** | an independent verifier that cannot edit files | the project's own test commands + `wizrelay audit` | `verification.md` |
| **Ship** | Developer, then CI | `git commit`, `git push`, the pull request, the CI audit | the branch and the pull request |

### Implement runs a command, not a conversation

`/wizrelay:implement` reads `plan.md`, works the unchecked steps in order inside the
role's `allow` scope, runs each step's own test and checks a step off only once that test
has passed. If the same step fails twice it stops and reports rather than trying a third
time.

Before, this gate opened a session with a sentence of prose and no brief — no scope, no
plan, and no record of which step it was on. A plan was written and then nothing carried
it out.

It writes no explanatory comments. Method and field summaries are the exception; a comment
that narrates code is a second copy of it that nobody updates.

It does not commit or push. That decision is yours, and in a panel run it belongs to the
approval step — see [Gate prompts and approvals](07-prompts.md).

## Steps — what a gate actually runs

A gate is a short list of steps, and the dashboard runs them. The **Steps** tab lists each
one with the command already filled in — `wizrelay pull CU-86c1abcd`, not
`wizrelay pull <ref>` — so a step is something you press rather than something you copy.

Each step runs on its own, so a step that failed can be retried without replaying the ones
that worked. A step says where it runs (the hub, or the project repository), whether it
only reads, and whether it will stop to ask you something.

Three rules shape the run:

- **Nothing outward happens without a yes.** A commit or a push pauses and shows you the
  exact command first. Declining skips that step and caps the verdict at `PARTIAL`; it
  never fails the gate, because choosing not to push is not an error.
- **A missing value is asked for, not guessed.** `publish-prep` needs a changelog line and
  `ship` needs a commit message, so the gate pauses for them.
- **A step that cannot run says why.** No repository connected for this role, no CLI on
  PATH, no Claude session — each is a failed check naming the cause, never a silent skip.

A conversational step hands over to Claude Code in that working copy, and comes back with
the rest of the gate still to run.

## Running a whole track

**Run the research track** and **Run the delivery track** walk their gates in order. The
chain stops at the first gate that fails or asks a question, because the gates after it
were going to assume it finished — that is what a pipeline is. A gate that already
finished is skipped rather than re-run, so continuing a half-finished track picks up where
you left off.

The result says which gates ran and where it stopped. Nothing runs unattended that would
have asked you something: an approval still stops the chain.

## The fan-out

Research runs once per relay. Delivery and ship run once per **role**: a package with a
backend and a frontend slice produces two delivery tracks, and the relay is finished when
every role's Ship gate has passed. The board draws this as a bracket under the research
pipeline.

## Statuses

Nine statuses, each with its own icon and label — never colour alone:

`Not started` · `Running` · **`Waiting for you`** · `Waiting on the researcher` · `Passed` ·
`Passed with warnings` · `Failed` · `Blocked` · `Skipped`

The board sorts `Waiting for you` first, then `Failed`, then `Waiting on the researcher`.
Everything else is below the fold, because everything else can wait.

### Re-running a gate resets the ones after it

A gate's verdict is about the work in front of it. Re-run research and the validation that
passed yesterday passed a package that no longer exists — so it is cleared, along with
everything downstream of it, in both tracks.

That includes a developer's finished `implement`, which sounds harsh and is the point:
their plan was built against a package that has since changed, and the relay exists to
make that visible rather than to let it through. The code they wrote is untouched; what is
reset is the panel's record of a gate having been run, and the console transcript stays in
the event log either way.

The gates that re-lock say why — *blocked until research passes* — so the sequence has to
be walked again in order.

<!-- foot -->
← Previous: [Setting up the panel](03-initialize.md) · [Documentation](README.md) · Next: [The relay board](05-board.md) →
<!-- /foot -->
