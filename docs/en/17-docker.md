<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/17-docker.md)
<!-- /nav -->

# Running the panel on a server

**This page is for whoever installs the panel.** No repository, no Node, no build —
only Docker. The image is published on Docker Hub, and what follows pulls it and runs it.

If you are working on the panel itself, see
[Working on wizrelay-gate](14-development.md), which is also where releasing lives.

wizrelay-gate is a panel a team signs in to. One container is the whole installation: the
image carries its own PostgreSQL, applies its own migrations and keeps everything on one
volume.

## The shortest way

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 \
  -v wizrelay-gate-data:/data \
  -e OWNER_EMAIL=you@example.com \
  -e OWNER_PASSWORD='a-long-password' \
  wizrelay/gate:beta
```

That is it. The container initialises its database on first boot, applies the migrations,
creates the first owner and serves the panel on port 3100. It generates its own
`AUTH_SECRET` onto the volume if you do not supply one, so sessions survive a restart.

## With compose

You do not need the repository. Make a folder, write these two files, and bring it up.

`docker-compose.yml`:

```yaml
services:
  gate:
    image: wizrelay/gate:beta
    restart: unless-stopped
    ports:
      - '3100:3100'
    env_file: .env
    volumes:
      - gate-data:/data

volumes:
  gate-data:
```

`.env`:

```ini
# The first owner, created on first boot only.
OWNER_EMAIL=you@company.com
OWNER_PASSWORD=a-long-password

# The address the panel is reached at from outside. Set this behind a proxy.
WIZRELAY_GATE_URL=https://panel.company.com

# Gates run on each person's own machine.
WIZRELAY_GATE_EXECUTION=agent

# Left empty, the container uses its own PostgreSQL and its own signing secret.
DATABASE_URL=
AUTH_SECRET=
```

```bash
docker compose up -d
```

One service, no database service to run beside it. `.env` carries a password — leave it
unreadable to anybody else (`chmod 600 .env`) and keep it out of version control.

## The first owner

`OWNER_EMAIL` and `OWNER_PASSWORD` are read on the first boot only, while no user exists
in the database. Once the account is there the variables are never looked at again —
changing the password is not an edit to `.env`, it is done in the panel.

**Leave either one empty and no account is created.** The panel still starts and still
passes its health check, but nobody gets past the login screen, because there is no user
inside. Recovery is easy: set the variables and start it again. There is still not one
user, so the account is created on that boot. You do not have to delete the volume.

### A `$` in `.env` quietly truncates the password

Compose reads a `$` in `.env` as the start of a variable. Write `ab$cd-ef` and the value
that reaches the container is `ab-ef`: `$cd` is undefined, so it becomes nothing. There is
no warning, and quoting does not help. The panel installs cleanly, the password does not
work, and nothing says why.

| Where you write it | How |
|---|---|
| `.env` | Double the `$`: `ab$$cd-ef` reaches the container as `ab$cd-ef`. |
| `docker run -e` | A single `$` passes through. Single-quote it so the shell leaves it alone. |

The cleanest answer is a password with no `$` in it. Length is what makes it safe, not
punctuation.

## Which tag to pull

| Tag | What it means |
|---|---|
| `wizrelay/gate:0.1.0-beta.1` | Exactly that version. On a server this is the right one: you decide when it changes. |
| `wizrelay/gate:beta` | The latest beta. For trying it out. |
| `wizrelay/gate:latest` | The latest stable release. Not published until there is one. |

> Until the first stable release there is no `latest`; you can also pin a version
> instead of `beta` above (`wizrelay/gate:0.1.0-beta.1`).

## Using your own PostgreSQL

Set `DATABASE_URL` and the built-in database is never started:

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 -v wizrelay-gate-data:/data \
  -e DATABASE_URL='postgresql://user:pass@db.internal:5432/wizrelay_gate' \
  -e AUTH_SECRET='…' \
  wizrelay/gate:beta
```

Build with `--build-arg EMBEDDED_POSTGRES=false` to leave PostgreSQL out of the image
entirely.

## The environment

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Your own PostgreSQL. Leave it unset to use the built-in one. |
| `AUTH_SECRET` | Signs sessions and encrypts stored ClickUp and GitHub tokens. Generated onto the volume when unset. |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | The first owner, created on first boot only. Leave either empty and nobody can sign in — [The first owner](#the-first-owner). |
| `PANEL_NAME`, `PANEL_LOGO_URL`, `PANEL_FAVICON_URL`, `PANEL_ACCENT` | Branding. The owner can override each in the panel. |
| `WIZRELAY_GATE_HOME` | Where hub clones, gate logs and the branding files live. `/data` in the container. |
| `WIZRELAY_GATE_EXECUTION` | `agent`, `local` or `auto`. See below. |
| `CLICKUP_API_TOKEN`, `GITHUB_TOKEN` | Shared fallbacks. A person's own connection wins. |

Everything on `/data` is the installation: the database, the hub clones, the gate logs and
the branding files. Back up that volume and you have backed up the panel.

## Where gates run

There are two answers, and which one you pick decides everything below it.

**On each person's own machine (recommended, and what compose sets).** The panel runs
nothing. Every developer runs an agent on their own machine, and a gate somebody starts
runs in their checkout, with their git identity and their Claude session. No repository is
mounted on the server and nobody's credentials are kept there. [Running on your own
machine](19-agent.md) sets it up.

```
WIZRELAY_GATE_EXECUTION=agent
```

**On the server itself.** The panel runs gates on its own machine, so the repositories
have to be there. Reasonable for a single-person install; not for a team panel, because
that machine would commit on everybody's behalf.

```
WIZRELAY_GATE_EXECUTION=local
```

The default, `auto`, does both: a paired machine when there is one, this machine
otherwise.

## Repositories

A project is a repository chosen from the ones your **GitHub token** can see. The panel
clones nothing: it records the repository, and whichever machine runs the gate is the
machine that already has it. Connect the token under
[Settings → Connections](12-settings.md).

The hub is the exception and needs no mount either: the panel clones it into `/data` and
keeps it current, because it has to read the packages itself.

### The address the panel hands out

Two things people are given carry the panel's address and nothing else: the **invitation
link** and the **pairing command**. Behind a proxy the request's own `Host` is the proxy's
internal name and the scheme is plain HTTP, so both can be built wrong and neither failure
is yours to notice — it is found by the person who cannot sign in.

Set it once and the guessing stops:

```
WIZRELAY_GATE_URL=https://panel.company.com
```

Without it the panel reads `X-Forwarded-Host` and `X-Forwarded-Proto` before the request's
own, and leaves a panel on `localhost` over plain HTTP. Make sure your proxy sends both
headers.

## Who can sign in

Nobody signs up. The first owner comes from the environment; after that, an owner or an
admin adds people by the email their Claude account uses and sends them the invitation
link the panel produces. What each person can then reach is
[Who sees what](20-access.md).

## Branding per installation

Three ways in, and the first one that answers wins:

1. **A file in the branding directory.** `$WIZRELAY_GATE_HOME/branding/logo.png` and
   `favicon.ico` — on the volume, so they survive a redeploy. Upload them in
   Administration → Panel, or drop them in before the first start. The extensions `.png`,
   `.jpg`, `.webp`, `.svg` and `.ico` are read; the limit is 512 KB.
2. **A link** typed into Administration → Panel, for an image already hosted somewhere.
3. **The environment**: `PANEL_NAME`, `PANEL_LOGO_URL`, `PANEL_FAVICON_URL`,
   `PANEL_ACCENT`.

Nothing needs rebuilding, and `public/` is never written to — it is part of the image and
would be lost on the next deploy.

## Health

`GET /api/health` reports the database, the signing secret, and whether `git`, `python3`,
`wizrelay` and `claude` are on PATH. The container's healthcheck uses it, with a 60-second
start period so a first boot has time to initialise its database.

## Upgrading

```bash
docker pull wizrelay/gate:beta
docker rm -f wizrelay-gate
docker run -d --name wizrelay-gate -p 3100:3100 -v wizrelay-gate-data:/data wizrelay/gate:beta
```

Migrations run on start. The volume carries the database, the secret and everything else,
so the new container picks up where the old one left off. Pin a version rather than
`latest` if you would rather decide when that happens — see
[Working on wizrelay-gate](14-development.md) for how the versions are numbered and
published.

<!-- foot -->
← Previous: [FAQ](16-faq.md) · [Documentation](README.md) · Next: [People, roles and activity](18-activity.md) →
<!-- /foot -->
