<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/09-scope-and-audit.md)
<!-- /nav -->

# Scope protection and the audit

The plugin protects scope in five layers. The dashboard shows what those layers decided;
it never decides anything itself.

## What the audit reports

`wizrelay audit --format json` answers with four lists and an integrity check:

| | |
|---|---|
| **In scope** | changed paths the role's `allow` globs cover |
| **Out of scope** | changed paths nothing covers |
| **Explicitly forbidden** | changed paths a `deny` glob matched, with the glob |
| **Incidental** | side-effects of setup that are not violations |
| **Integrity** | locked researcher files that changed, went missing, or are not in the lock |

The verdict sentence is the plugin's own: *No violations. 13 changed path(s) are all
accounted for.*

## Guard events

Every `deny` and every `ask` the `PreToolUse` hook produced during Implement, with the
file, the rule that matched and what the person did about it. This is the timeline that
explains a `PARTIAL` verification two days later.

## When protection is not active

If the hooks did not run in a session — another plugin claiming the same manifest name,
`disableAllHooks`, an untrusted folder — the dashboard shows a persistent banner. Scope
protection failing **silently** is the failure the whole product exists to prevent, so the
banner is not dismissible for the session and names the three likely causes.

## What the dashboard cannot do

It cannot override a `deny`. It cannot widen a scope. Both are the researcher's call, and
the way to reach them is the question loop.

<!-- foot -->
← Previous: [Model and effort routing](08-routing.md) · [Documentation](README.md) · Next: [The verification report](10-verify.md) →
<!-- /foot -->
