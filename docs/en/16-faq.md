<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/16-faq.md)
<!-- /nav -->

# FAQ

**Does this replace the wizrelay plugin?**
No. It drives it. Every deterministic result comes from the `wizrelay` CLI, and the plugin
stays fully usable from a terminal.

**Do I need Claude Code installed?**
Only for the conversational gates against a real repository. Without it, those gates play
the bundled transcript, and the console says which engine it is running.

**Where does my data go?**
Nowhere. There is no account and no server. The dashboard reads your repositories and
writes `.wizrelay-gate/` on your machine.

**Can the dashboard override a blocked edit?**
No. A `deny` is final; the dashboard shows the rule that matched and points at the
question loop.

**Why two design directions?**
Because the same product is used by people who want an instrument panel and people who
want a calm document. They share every screen, every component and every string; only the
tokens and a few layout choices differ.

**Can I use it with two roles in one repository?**
Not yet — the plugin itself is one role per repository in v1. A task with two roles shows
two delivery tracks, each pointing at its own repository.

**Why is `NOT COVERED` not a failure?**
Because it is true. A criterion nothing proves is not a criterion that failed; it is a
test somebody still has to write, and the report names it.

**What happens if I close the browser mid-gate?**
The answer and the events are on disk. Reopen the console and it replays from the log; a
gate that was waiting is still waiting.

<!-- foot -->
← Previous: [Troubleshooting](15-troubleshooting.md) · [Documentation](README.md) · Next: [Running on a server](17-docker.md) →
<!-- /foot -->
