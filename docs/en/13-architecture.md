<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/13-architecture.md)
<!-- /nav -->

# How the code is organised

Feature folders, with a layering rule a test enforces.

```
src/
├── app/           Next.js routes only — each page wires a screen up and holds no logic
├── core/          the pure domain: gates, statuses, relays, routing, parsers, time
├── services/      everything that touches the world: the CLI, git, the store, the engines
├── features/      one folder per feature, each with its components and server actions
└── shared/        the design system, the UI kit, i18n, small helpers
```

## The layering rule

```
core (pure, no IO)  ←  services (git, filesystem, processes)  ←  features  ←  app
```

`core` imports nothing above it. `services` may not reach into a feature. `shared` may not
reach into services or features. `tests/architecture.test.ts` fails the build when any of
that stops being true — the same guard the wizrelay plugin keeps over its own layers.

## The features

`shell` · `board` · `relay-run` · `console` · `gate-prompts` · `initialize` ·
`package-workspace` · `validate` · `routing` · `audit` · `verify` · `questions` ·
`packages` · `settings` · `system`

## The engines

A gate is an async function with a pause in the middle. Three engines implement that:

| Engine | When it runs |
|---|---|
| **scripted** | the sample workspace, and anywhere the real tools are missing — it plays a deterministic transcript and genuinely blocks on every prompt |
| **live CLI** | the deterministic gates in a connected workspace: it runs `wizrelay pull`, `wizrelay audit` and friends, and turns their output into checks |
| **claude** | the conversational gates in a connected workspace: a headless `claude -p` session streamed into the console |

The runner owns what is running, appends every event to the log, keeps the relay's gate
state in step, and resolves a prompt when a person answers it. Its registry lives on
`globalThis`, because a server action and a route handler can otherwise get separate
instances of the same module.

## How a package file is shown

A package is Markdown and JSON. The research package screen draws it as the document it
is rather than printing it into a `<pre>`: the headings, the checked plan steps, the
acceptance table and, above all, the unfilled `{{placeholders}}` become visible. Each file
carries a **Readable** / **Source** switch, and the source view is the exact bytes on
disk — the promise that edits here land in the package only holds if there is a view that
shows what is written. JSON is drawn as a foldable tree.

The reader lives in `src/core/markdown/parse.ts`. It is pure, and it neither produces HTML
nor accepts it: a package comes out of a git repository that everyone with push access
writes to, so there is no safe way to hand its raw markup to a browser. Anything it does
not understand stays text.

Three deliberate departures from CommonMark:

- **A single newline inside a paragraph is kept.** CommonMark folds soft breaks into
  spaces, which would collapse the Given / When / Then shape every acceptance file is
  written in into one sentence.
- **Code spans are read before emphasis.** A scope file is full of globs like
  `app/quota/**`, and reading emphasis first would pair the stars of two separate globs
  and bold the text between them.
- **A `{{…}}` is marked inside a code span too.** `wizrelay hub validate` scans the file
  as plain text and counts a placeholder wherever it sits. Counting them any other way
  would show a package as ready for a gate that is about to turn it back.

Unsupported, and left as plain text on purpose: reference links, footnotes, setext
headings, HTML blocks and backslash escapes. A link opens only for `http(s)`, `mailto` and
in-document targets; any other scheme is shown as text. Images are drawn as links too —
loading a remote image would tell that host who is reading the panel.

## What does not fit in the space it is given

Some panels hold a document's worth of material in a column the layout can spare: a
twenty-five item acceptance list, a scope with forty globs, a decisions log, the package
file itself. The right size for finding something, the wrong size for reading it.

So anything dense carries an expand icon in its corner, and the same content opens at the
size of the screen. The content is **moved, not copied** — a second copy would keep its
own state, so a file open on its source tab would come back readable in the dialog.

## Where the numbers come from

Every screen reads the package off disk: the hub's working copy for the researcher's
files, and the project repository for the developer's — `plan.md`, `questions.md`,
`verification.md`. When both hold the same file the repository's copy wins, because that
is the one the work was done against, and the file tree says which folder answered.

| Screen | Read from |
|---|---|
| Acceptance criteria | `acceptance.md` in the package |
| Decisions | `decisions.md` in the package |
| The verification report | `verification.md` in the project repository |
| The validate report | `wizrelay hub validate` |
| Scope and audit | `wizrelay audit --format json` |
| Routing signals | `routing.signals` in `task.json` |

When one of those is missing, the screen says so. It never shows a sample report in its
place: a clean audit that belongs to someone else reads as a statement about *your*
working tree, which is worse than no answer. The bundled sample package appears only in
the demo workspace, which announces itself on the board.

## The design system

`src/shared/design-system/wizrelay-gate.css` comes from the design canvas verbatim and is
the single source of truth for tokens and component styling. The React components emit the
classes it defines; `src/app/globals.css` adds only what a real document needs and an
artboard does not.

<!-- foot -->
← Previous: [Settings, connections and privacy](12-settings.md) · [Documentation](README.md) · Next: [Working on wizrelay-gate](14-development.md) →
<!-- /foot -->
