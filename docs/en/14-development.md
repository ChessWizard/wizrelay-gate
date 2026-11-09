<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/14-development.md)
<!-- /nav -->

# Working on wizrelay-gate

**This page is for people working on the panel's code** — cloning the repository,
running the tests, publishing a release. If you only install and use the panel you need
none of it: [Running on a server](17-docker.md) and
[Setup, end to end](21-walkthrough.md) are where you belong.

## Commands

```bash
npm run dev         # the dashboard, with hot reload
npm run build       # the production build
npm start           # serve the build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run docs:nav    # regenerate the documentation navigation
npm run smoke       # ask a running panel the questions a browser would
npm run check       # typecheck + lint + test + build
```

`npm run smoke -- http://127.0.0.1:3100` asks a panel that is already running whether its
routes exist, whether they refuse a request with no session, and whether a page that moved
still answers at its old address. It signs in as nobody and writes nothing, so it is safe
against a panel holding real work. It is the layer the unit tests cannot reach: wiring,
not rules.

To build and check without disturbing a panel you already have running, give the build a
directory of its own:

```bash
WIZRELAY_GATE_DIST=.next-verify npm run build
WIZRELAY_GATE_DIST=.next-verify PORT=3101 npx next start
npm run smoke -- http://127.0.0.1:3101
```

## Conventions

- **TypeScript, strict.** No `any` in app code; the CLI's JSON is parsed with zod schemas
  at the boundary and typed from there.
- **Every user-visible string is a catalogue key.** No sentence is assembled from
  fragments in code — Turkish inflects where English does not. `tests/i18n.test.ts` keeps
  the two catalogues at exactly the same keys and the same placeholders.
- **Server components by default.** A component becomes a client component when it owns
  state the server cannot: the console stream, the prompt cards, the view switches.
- **Comments say why.** The what is in the code.

## Tests

| File | What it protects |
|---|---|
| `tests/routing.test.ts` | the score, the tiers, the launch command, glob intersection |
| `tests/gates.test.ts` | the gate graph and the status model |
| `tests/parsers.test.ts` | the package text formats, in English and Turkish |
| `tests/derive.test.ts` | relay status, the current gate, the board metrics |
| `tests/i18n.test.ts` | catalogue parity and placeholder parity |
| `tests/store.test.ts` | the workspace patch, the relay round-trip, the event log |
| `tests/time.test.ts` | durations and relative time in both locales |
| `tests/architecture.test.ts` | the layering rule and the feature folders |
| `tests/docs.test.ts` | both languages have the same sections, and the navigation is current |

## A note on the dev server

Turbopack's hot reload does not always pick up a change made by a tool rather than an
editor. If a page looks stale after an edit, restart `npm run dev` before looking for the
bug elsewhere.


## Two macOS dev snags

**`EMFILE: too many open files` and every route 404s.** Watchpack opens a descriptor per
watched directory; when it runs out, the route tree comes back empty and every path 404s,
including `/api/health`. Raising `ulimit -n` does not reliably help — on macOS the ceiling
is `kern.maxfilesperproc`, and the limit that works one day fails the next.

`npm run dev` therefore sets `WATCHPACK_POLLING=true`, which stops watchpack opening those
descriptors at all. Turbopack does the watching that matters, so this costs no measurable
CPU. If you run `next dev` by hand and the routes 404, set that variable yourself.

**A stale `.next` after a crash.** If routes 404 after the server died mid-compile, delete
`.next` and start again.

## Publishing a release (maintainers only)

The version in `package.json` is the one the image carries. It follows semver, read from
the point of view of somebody running the panel:

| Change | Bump |
|---|---|
| A migration that cannot be rolled back, an environment variable that is now required, a route that is gone | **major** |
| A new screen, a new gate behaviour, a new setting | **minor** |
| A fix, a wording change, a design change that breaks nothing | **patch** |

### Branches

`main` is always releasable: it is what the `latest` tag is built from, and nothing lands
on it that has not passed `npm run check`.

Work happens on a branch named for what it does — `feat/question-routing`,
`fix/board-loop` — and lands on `main` as one commit with a conventional-commit subject.
A release is a tag on `main`, `v0.3.0`, never a branch of its own; a release branch would
be a second place for the truth to live.

### The first release is a beta

A beta says one thing: *this is meant to be used, and it may still move under you.* It
earns a version like any other release, and the version is the thing that ties the git tag
and the Docker Hub tag together.

```
package.json 0.1.0-beta.1  →  git tag v0.1.0-beta.1  →  wizrelay/gate:0.1.0-beta.1
```

One number, three places, no translation between them. Somebody who reports a bug against
`0.1.0-beta.1` names a commit you can check out and an image you can run.

**`latest` is not a beta.** It is what somebody gets who types no tag at all, and that
should be a release you would defend. While the only releases are betas, push
`0.1.0-beta.1` and `beta`, and leave `latest` unpushed until the first stable version.

### Branches for a beta

`main` is still always releasable; a beta does not change that.

```
feat/question-routing ─┐
fix/board-loop ────────┼─► main ──► tag v0.1.0-beta.1 ──► image 0.1.0-beta.1
docs/walkthrough ──────┘            tag v0.1.0-beta.2
                                    tag v0.1.0            ← the stable one, same line
```

Work happens on a branch named for what it does and lands on `main` as one commit. The
beta is a **tag on `main`**, not a branch of its own, and so is the stable release that
follows it — `0.1.0-beta.2` and `0.1.0` are points on the same line, not two lines.

A release branch (`release/0.1.0`) is worth opening only when you have to fix a shipped
beta while `main` has already moved past it. Until that happens it is a second place for
the truth to live.

### Numbering the betas

| What happened | Next version |
|---|---|
| Another round of beta fixes | `0.1.0-beta.2` |
| Beta is good enough to stand behind | `0.1.0` |
| A fix after `0.1.0` | `0.1.1` |
| The next feature round | `0.2.0-beta.1` |

`0.1.0-beta.2` sorts before `0.1.0` under semver, which is what you want: the stable
release supersedes its own betas.

### Publishing the first beta, step by step

**1 · Set the version.** It is the one number everything else copies.

```bash
npm version 0.1.0-beta.1 --no-git-tag-version
```

**2 · Prove it works.** Nothing goes out that has not passed.

```bash
npm run check
```

**3 · Commit and tag on `main`.**

```bash
git add -A
git commit -m "release: 0.1.0-beta.1"
git tag -a v0.1.0-beta.1 -m "wizrelay-gate 0.1.0-beta.1"
```

**4 · Build the image with the same number.**

```bash
VERSION=$(node -p "require('./package.json').version")
docker build -t wizrelay/gate:$VERSION -t wizrelay/gate:beta .
```

**5 · Smoke-test the image you are about to push**, not the one you built last week.

```bash
docker run --rm -d --name gate-check -p 3109:3100 -v gate-check:/data \
  -e OWNER_EMAIL=check@example.com -e OWNER_PASSWORD='check-pass-1234' \
  wizrelay/gate:$VERSION
npm run smoke -- http://127.0.0.1:3109
docker rm -f gate-check && docker volume rm gate-check
```

**6 · Push.** The version first, the moving tag second — if something goes wrong between
them, `beta` still points at the release that worked.

```bash
docker login
docker push wizrelay/gate:$VERSION
docker push wizrelay/gate:beta
git push origin main --follow-tags
```

**7 · Tell people what to run.** A beta is pinned by whoever installs it:

```bash
docker run -d -p 3100:3100 -v wizrelay-gate-data:/data wizrelay/gate:0.1.0-beta.1
```

### Before the first push

The repository on Docker Hub has to exist and be yours: **hub.docker.com → Create
repository**, named `gate` under your account or organisation, so the image is
`<account>/gate`. Use an **access token** rather than your password — *Account Settings →
Personal access tokens*, with Read & Write. `docker login` takes it as the password.

If your account is not `wizrelay`, replace it everywhere above; the name in the image is
the account that owns it.

### For several architectures

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t wizrelay/gate:$VERSION -t wizrelay/gate:beta --push .
```

A multi-platform build pushes straight from the builder, so run step 5 on a
single-platform build of the same commit first — you cannot smoke-test an image buildx
never loaded locally.

### When the beta becomes stable

The same seven steps, with two changes: the version loses its `-beta.N`, and the moving
tag is `latest` rather than `beta`.

```bash
npm version 0.1.0 --no-git-tag-version
npm run check

VERSION=$(node -p "require('./package.json').version")
docker build -t wizrelay/gate:$VERSION -t wizrelay/gate:latest .
# smoke-test $VERSION, as above
docker push wizrelay/gate:$VERSION
docker push wizrelay/gate:latest
git tag -a v$VERSION -m "wizrelay-gate $VERSION" && git push origin main --follow-tags
```

`latest` from this point means the newest stable release. Keep pushing `beta` for betas;
somebody tracking one should not be moved onto a stable line without asking.

<!-- foot -->
← Previous: [How the code is organised](13-architecture.md) · [Documentation](README.md) · Next: [Troubleshooting](15-troubleshooting.md) →
<!-- /foot -->
