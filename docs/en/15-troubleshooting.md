<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/15-troubleshooting.md)
<!-- /nav -->

# Troubleshooting

## "wizrelay is not on PATH, so gates run on the bundled transcript"

The CLI is not installed. Gates still run — they play a deterministic transcript — but
nothing touches your repositories. Install it with:

```bash
pip install "git+https://github.com/ChessWizard/wizrelay@main"
```

## The console says "This gate has not started yet"

The gate has no events yet. Press **Start this gate** on the run screen, or send a message
in the composer. A gate that is `Waiting for you` already has a prompt — answer it and the
gate continues from there.

## The hub will not connect

| What it says | What it means |
|---|---|
| *This repository has no `wizrelay-hub.json`* | the folder is a git repository but not a hub; create one with `wizrelay hub init` |
| *No access* | git could not read it with your credentials — add an SSH key or sign in with your credential helper |
| *Credentials are embedded in the URL* | refused on purpose; use SSH or a credential helper |

## The board shows the sample workspace and I connected a hub

Connecting a hub sets the workspace to `live`, but a hub reached over SSH is only listed,
not read: clone it locally and point the hub at that folder, so the dashboard can read
`tasks/*/task.json`.

## The sample data looks wrong after an upgrade

Settings → Diagnostics → **Reset the sample workspace** rewrites it.

## Scope protection is not active

The banner names the three causes the plugin checks for: another installed plugin using
the manifest name `wizrelay`, hooks disabled, or an untrusted folder. Run
`/wizrelay:doctor` in that repository.

## Nothing streams in the console

The stream needs the Node runtime and a direct connection. Behind a proxy that buffers
responses, server-sent events arrive in one lump at the end; the dashboard sets
`x-accel-buffering: no`, which most proxies honour.

<!-- foot -->
← Previous: [Working on wizrelay-gate](14-development.md) · [Documentation](README.md) · Next: [FAQ](16-faq.md) →
<!-- /foot -->
