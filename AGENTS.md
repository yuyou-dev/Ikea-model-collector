# Maintainer instructions

This repository is the canonical, general-purpose source of the
`ikea-model-collector` Agent Skill. It originated from the
`BlenderWithDreamina` project, which also maintains a project-specific adapter,
Blender dimension enrichment, and local collection integration.

## Non-negotiable boundaries

- Never commit IKEA GLB/GLTF files, textures, Blender files, model ZIPs,
  downloadable model URL catalogs, local collections, caches, credentials, or
  other redistributable IKEA assets.
- Keep the workflow user-directed, low-frequency, and browser-observed. Do not
  add unattended crawling, product-number URL guessing, or a centralized model
  mirror.
- Preserve the independent-project and personal research/non-commercial use
  warnings in `README.md`, `README.zh-CN.md`, `NOTICE`, and the Skill.
- Treat Apache-2.0 as covering only this repository's original code and text.
- Run tests, Skill validation, and the forbidden-asset audit before release.

## Upstream and downstream maintenance

- Make reusable workflow changes here first, then synchronize them into
  `BlenderWithDreamina/.agents/skills/ikea-model-collector`.
- Keep BlenderWithDreamina-specific paths and its `.blender-codex` compatibility
  in that project's adapter. Do not add them to the standalone CLI contract.
- Keep `SKILL.md` concise and move detailed contracts into one-level
  `references/` files according to the Skill Creator guidance.
- Do not mark a release complete until `docs/launch-checklist.md` is current.
