<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/10-verify.md)
<!-- /nav -->

# The verification report

Verification is done by an agent that cannot edit files, so that nobody downstream has to
wonder whether the code was changed to make a test pass.

## Every criterion, with evidence

Each acceptance criterion gets a result and the command that proves it:

| Result | What it means |
|---|---|
| `PASS` | the verification command ran and passed |
| `FAIL` | it ran and failed |
| `NOT COVERED` | nothing in the repository proves it |

`NOT COVERED` is a first-class result and is drawn in its own neutral register. It is not
a failure — it is usually the most useful line in the report, and it names the test that
would close it.

## The overall verdict

| Verdict | Rule |
|---|---|
| `PASS` | every applicable criterion passes, the full suite passes, the audit is clean |
| `PARTIAL` | everything covered passes, but the audit found violations or a criterion is `NOT COVERED` |
| `FAIL` | any criterion fails, or the full suite fails |

The screen states the rule that produced the verdict, and says plainly that any scope
violation caps the result at `PARTIAL` however well the tests pass.

## The tracker comment

The report ends with the comment the plugin would post:

```
[WIZRELAY-VERIFY] CU-86c1abcd — backend — PARTIAL
```

It is an approval, not a side-effect: the text is shown in full and nothing is posted
until you approve it.

<!-- foot -->
← Previous: [Scope protection and the audit](09-scope-and-audit.md) · [Documentation](README.md) · Next: [The question loop](11-questions.md) →
<!-- /foot -->
