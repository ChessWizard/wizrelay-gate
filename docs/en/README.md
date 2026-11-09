<!-- nav -->
[wizrelay-gate](../../README.md) · [Türkçe](../tr/README.md)
<!-- /nav -->

# Documentation

One guide, one file per section. Start at the overview; every page links to the next.

| Section | What it covers |
|---|---|
| 1. [Overview](01-overview.md) | wizrelay-gate is a local-first dashboard that runs a wizrelay task as a pipeline of task quality gates. |
| 2. [Install and run](02-install.md) | New here? **[Setup, end to end](21-walkthrough.md)** walks the whole thing in order. |
| 3. [Setting up the panel](03-initialize.md) | The first person to sign in is the owner, created from `OWNER_EMAIL` and `OWNER_PASSWORD` |
| 4. [The nine task quality gates](04-gates.md) | A relay is one task flowing end to end. A gate is the unit of progress. |
| 5. [The relay board](05-board.md) | The screen the app opens to, and the one that answers "what needs me?" in under two seconds. |
| 6. [The run and its console](06-run-and-console.md) | The relay run screen is where a single task is watched; the console is where it is talked to. |
| 7. [Gate prompts and approvals](07-prompts.md) | A gate prompt is the moment the pipeline stops and needs a person. There are five kinds, |
| 8. [Model and effort routing](08-routing.md) | Which model, and how much thinking, each phase of a task gets. |
| 9. [Scope protection and the audit](09-scope-and-audit.md) | The plugin protects scope in five layers. The dashboard shows what those layers decided; |
| 10. [The verification report](10-verify.md) | Verification is done by an agent that cannot edit files, so that nobody downstream has to |
| 11. [The question loop](11-questions.md) | The one flow that crosses two people, and the one the dashboard measures honestly. |
| 12. [Settings, connections and privacy](12-settings.md) | Settings → **Your password**. You need your current one to change it: the session already |
| 13. [How the code is organised](13-architecture.md) | Feature folders, with a layering rule a test enforces. |
| 14. [Working on wizrelay-gate](14-development.md) | **This page is for people working on the panel's code** — cloning the repository, |
| 15. [Troubleshooting](15-troubleshooting.md) | The CLI is not installed. Gates still run — they play a deterministic transcript — but |
| 16. [FAQ](16-faq.md) | **Does this replace the wizrelay plugin?** |
| 17. [Running on a server](17-docker.md) | **This page is for whoever installs the panel.** No repository, no Node, no build — |
| 18. [People, roles and activity](18-activity.md) | Nobody signs up. The first owner comes from `OWNER_EMAIL` and `OWNER_PASSWORD` on first |
| 19. [Running on your own machine](19-agent.md) | The panel sits on a server; the commands run on your machine. |
| 20. [Who sees what](20-access.md) | A panel that everybody can see everything in is not a shared panel, it is a shared |
| 21. [Setup, end to end](21-walkthrough.md) | Every step from an empty machine to a working panel, in order. Each heading is done once; |
