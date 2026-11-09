# Documentation

Two languages, the same sections. English is the default.

- **[English](en/README.md)**
- **[Türkçe](tr/README.md)**

The navigation on each page is generated. After adding or renaming a section, edit
`scripts/docs-nav.mjs` and run:

```bash
npm run docs:nav
```

`tests/docs.test.ts` fails when the two languages drift apart or the navigation is stale.
