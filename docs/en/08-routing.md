<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/08-routing.md)
<!-- /nav -->

# Model and effort routing

Which model, and how much thinking, each phase of a task gets.

## The score, as arithmetic

```
score = complexity + risk + ambiguity        (low = 1, medium = 2, high = 3)
      + 1 if the codebase is large
      + 1 if test maturity is low
      + 1 if the role's scope touches a critical path
      + 1 if the role's scope touches legacy code
```

The signals come from the task (the researcher sets them, and may set them per role); the
modifiers come from the repository's `profile.json`. The same task can therefore route
differently in two repositories, and the routing screen shows the whole sum rather than
just the result.

## The tiers

| Tier | Score | Plan | Implement | Verify |
|---|---|---|---|---|
| `T0-mechanical` | `kind: mechanical` | sonnet / low | haiku / medium | sonnet / medium |
| `T1-routine` | ≤ 4 | sonnet / medium | sonnet / medium | sonnet / medium |
| `T2-standard` | 5–6 | opus / high | sonnet / high | sonnet / high |
| `T3-critical` | 7–8 | opus / xhigh | opus / high | opus / high |
| `T4-high-risk` | ≥ 9 | opus / xhigh | opus / high + advisor | opus / xhigh |

## The launch command

```
claude --model opusplan --effort high --name 'CU-86c1abcd Tenant-based daily API request quota'
```

`opusplan` appears when the plan phase is Opus and the implement phase is Sonnet. An
advisor is kept only when it ranks at or above the main model; an ambiguous match is
dropped rather than proposed.

## Whose policy

The policy shown is the plugin's default. When a hub ships
`policies/routing-policy.json`, that policy replaces it — the dashboard names the source
and never prefers its own copy.

<!-- foot -->
← Previous: [Gate prompts and approvals](07-prompts.md) · [Documentation](README.md) · Next: [Scope protection and the audit](09-scope-and-audit.md) →
<!-- /foot -->
