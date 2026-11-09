<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/07-prompts.md)
<!-- /nav -->

# Gate prompts and approvals

A gate prompt is the moment the pipeline stops and needs a person. There are five kinds,
and they share one contract: name the gate, ask one sentence, say what each answer causes,
pre-select nothing.

## Decision

Claude offers options. Each one says what it means and what it costs to be wrong, and one
of them is always "I don't know — ask the researcher", which opens the question loop
instead of inventing a decision.

## Input

Free text, with the destination named — a changelog summary says that every developer will
read this line when they run `sync`.

## Approval

Push, tracker comment, pull request. These are the outward-facing actions, so the card
shows the **whole payload**: the exact command, the exact comment text, the remote and the
branch. An approval needs the confirm word typed, is never bundled with another approval,
and always offers "copy the command and run it myself".

## Scope permission

From the plugin's `ask` mode: the file, the in-scope globs, and three answers — allow once,
refuse, or ask the researcher instead. Each answer says what follows.

A `deny` is **not** a prompt. It cannot be overridden from the dashboard. It is shown as an
information card with the rule that matched and the way forward:

> `app/billing/invoice.py` is explicitly denied by the scope of `CU-86c1abcd` (pattern
> `app/billing/**`). Ask through `/wizrelay:ask`; the answer arrives as a new package
> version.

## Attachment

Claude asks for a screenshot, a diagram or an exported spec, with the package limits in
view: 5 MB per file, 20 MB per package, no symlinks.

## What happens to an answer

The answer is recorded first — in the relay and in the gate's event log — and only then
does the gate continue. That ordering is deliberate: an answer must survive a crash, a
restart, or the browser being closed between the question and the next event.

<!-- foot -->
← Previous: [The run and its console](06-run-and-console.md) · [Documentation](README.md) · Next: [Model and effort routing](08-routing.md) →
<!-- /foot -->
