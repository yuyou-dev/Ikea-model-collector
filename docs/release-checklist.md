# Release checklist

Use this checklist for every release. It is a gate, not a historical progress log.

## Product and documentation

- [ ] English and Chinese READMEs describe the same behavior and warnings.
- [ ] Agent-first, one-command, and manual installation paths are current.
- [ ] The portable Skill remains self-contained under `.agents/skills/ikea-model-collector/`.
- [ ] CLI and collection-schema references match implementation.
- [ ] No documentation implies that accessible IKEA assets are open source.

## Verification

- [ ] `npm ci` succeeds on the minimum supported Node.js version.
- [ ] `npm run check` passes.
- [ ] The installer is tested in a temporary project.
- [ ] The Skill validator passes on the canonical Skill directory.
- [ ] A clean clone can install the Skill and invoke its help/error path.

## Repository safety

- [ ] Repository audit finds no IKEA GLB, texture, cache, collection, credential, archive, or machine-local path.
- [ ] Showcase images are expressly permitted composites and contain no redistributable model payload.
- [ ] Git status contains only intended release changes.
- [ ] The release diff does not contain project-only Blender workflows from a downstream repository.

## Release

- [ ] Version and changelog/release notes agree.
- [ ] Tag and GitHub release are created from the verified commit.
- [ ] Installation commands are re-tested against the published tag.
