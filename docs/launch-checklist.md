# v0.1.0 launch checklist

This file is the release handoff and progress tracker. Check an item only after
the linked artifact or command has been verified.

## Repository

- [x] Apache-2.0 `LICENSE` and asset exclusions in `NOTICE` reviewed.
- [x] English and Chinese README content is complete and consistent.
- [x] Documentation images render and include rights warnings.
- [x] `AGENTS.md`, `CONTRIBUTING.md`, and `SECURITY.md` reviewed.
- [x] Repository contains no IKEA model, texture, archive, credentials, or URL catalog.
- [x] Worktree, staged diff, image metadata, and Git history contain no local username, absolute machine path, token, key, cookie, or signed URL.

## Skill and CLI

- [x] `SKILL.md` has only `name` and `description` frontmatter fields.
- [x] `agents/openai.yaml` matches the Skill.
- [x] `quick_validate.py` passes for the standalone Skill.
- [x] Official `skills-ref validate` passes when available.
- [x] `init`, `add`, `record-attempt`, `render`, `finalize`, `validate`, `show`, and `serve` are documented and tested.
- [x] Security limits, capture schema, and collection outputs match implementation.
- [x] Blender preview regression passes without copying the test model into this repository.
- [ ] Project-level and global installation instructions are tested.

## Quality gates

- [x] `npm test` passes on Node.js 22.
- [x] `npm run audit` passes.
- [x] `npm run check` passes.
- [x] End-to-end temporary collection test passes.
- [x] Gallery search, filters, local GLB loading, and browser console are checked.
- [x] One-product forward test passes with minimal context.
- [x] Five-candidate collection and handoff forward test passes with minimal context.

## Main project synchronization

- [x] BlenderWithDreamina `AGENTS.md` records the open-source maintenance relationship.
- [x] Reusable Skill improvements are synchronized to BlenderWithDreamina.
- [x] Existing `.blender-codex/ikea-collections` behavior remains compatible.
- [x] No local collection or unlicensed visual asset leaked into this repository.

## GitHub release

- [ ] Public `yuyou-dev/Ikea-model-collector` repository created with `main` default branch.
- [ ] Description and topics are set.
- [ ] GitHub Actions is green on `main`.
- [ ] Release commit SHA and CI URL are recorded in the final handoff.
- [ ] `v0.1.0` tag and release are published with the no-model/non-commercial warning.
