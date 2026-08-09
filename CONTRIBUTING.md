# Contributing

Thank you for improving Ikea-model-collector. Contributions should make local,
user-directed research workflows safer, clearer, or more reproducible.

## Before opening a change

1. Read `NOTICE` and preserve its asset and trademark boundaries.
2. Do not attach IKEA models, textures, archives, captured network payloads,
   credentials, or catalogs of downloadable model URLs to issues or commits.
3. Discuss changes that alter the acquisition contract before implementation.
   Browser extensions, unattended crawlers, model mirrors, URL guessing, and
   commercial redistribution workflows are out of scope.
4. Use Node.js 22 or newer.

## Development checks

```bash
npm test
npm run audit
npm run check
```

Keep the CLI dependency-free at runtime. Add focused tests for behavior changes,
update both README languages when public behavior changes, and update the launch
checklist for release work.

Before committing, scan the worktree and staged diff for local usernames,
machine-specific absolute paths, tokens, keys, signed URLs, cookies, and image
metadata. Use `/path/to/...`, `<repo>`, or synthetic values in examples.

By submitting a contribution, you agree that it is licensed under Apache-2.0
and that you have the right to submit it. Do not submit third-party material
unless its license is compatible and its attribution is documented.
