---
name: ikea-model-collector
description: Collect user-observed IKEA product GLB models into verified local research collections with provenance, dimensions, optional Blender previews, a Three.js gallery, indexes, and handoff. Use when Codex is asked to find an IKEA product's available 3D model, process a user-specified product list, import browser-captured IKEA GLB files, validate or enrich a local IKEA asset collection, render standardized thumbnails, or prepare a collection handoff. Do not use for unattended crawling, model redistribution, commercial asset acquisition, or URL guessing.
---

# IKEA Model Collector

Build traceable, local-only IKEA model collections. Keep every acquisition
user-directed and browser-observed. Never treat this Skill as permission to use,
redistribute, publish, or commercially exploit IKEA material.

## Start safely

1. Read [legal-boundaries.md](references/legal-boundaries.md).
2. Confirm the user has named a product or bounded product list and accepts the
   relevant IKEA site terms.
3. Run `init` with `--acknowledge-terms`; do not invent acceptance on the user's
   behalf.
4. Prefer the Codex in-app browser to discover the product page and observe its
   actual DIMMA `.glb` response. Never derive a model URL from a product number.
5. Save the browser response to a local file, then use `add --source-file`.
   For agents without browser network capture, request a user-provided local GLB
   and capture JSON. Read [browser-capture.md](references/browser-capture.md).

## Select the runtime

From the current project, first check for a project adapter documented by its
own `AGENTS.md` or package scripts. Use it when present so existing collection
paths remain compatible. Otherwise run the standalone CLI bundled with this
Skill:

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs <command> [options]
```

The standalone default root is
`<current-project>/.ikea-model-collector/collections/`. Do not redirect output
outside the current project. Read [download-contract.md](references/download-contract.md)
before using `add` with a remote URL.

## Execute a collection task

### 1. Initialize

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs init \
  --collection-id living-room-study \
  --locale en-US \
  --terms-url https://www.ikea.com/us/en/customer-service/terms-conditions/ \
  --acknowledge-terms
```

Use a stable lowercase collection ID. Record the locale and exact product URL
for every candidate.

### 2. Capture and add

Create an `ikea_product_capture.v1` JSON file from facts visibly present on the
product page. Preserve raw dimensions and normalize only separately. See
[collection-schema.md](references/collection-schema.md).

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs add \
  --collection-id living-room-study \
  --source-file /absolute/path/captured-model.glb \
  --capture-file /absolute/path/product-capture.json
```

Use `--model-url` only for an IKEA DIMMA URL observed in the current browser
session. Do not place credentials, cookies, signed query values, or secrets in
metadata. Process candidates serially and at low frequency.

If no model can be captured, record the outcome instead of silently omitting it:

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs record-attempt \
  --collection-id living-room-study \
  --product-url https://www.ikea.com/us/en/p/example/ \
  --result model_unavailable
```

Allowed failure statuses are `model_unavailable`, `discovery_failed`,
`capture_failed`, and `validation_failed`.

### 3. Render when requested

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs render \
  --collection-id living-room-study
```

Rendering is optional and requires Blender. Use the
`orthographic-shadow-v5` preset: square orthographic-isometric view, neutral
light-gray background, Cycles lighting, and a physical soft contact shadow.
Never modify or rescale the source GLB during preview generation.

### 4. Finalize and validate

```bash
node <skill-dir>/scripts/ikea-model-collector.mjs finalize \
  --collection-id living-room-study
node <skill-dir>/scripts/ikea-model-collector.mjs validate \
  --collection-id living-room-study
node <skill-dir>/scripts/ikea-model-collector.mjs show \
  --collection-id living-room-study
```

Use `serve` to open the generated local gallery through an HTTP origin. Keep the
server bound to loopback unless the user explicitly requests otherwise.

## Completion gate

Do not call a collection complete until all of the following are true:

- Each requested candidate is an asset or a recorded acquisition attempt.
- Every asset passes GLB v2 and declared-length validation and has SHA-256,
  product provenance, capture time, and a rights-use reminder.
- Page dimensions remain distinct from geometry bounds; mismatches are reported,
  not silently corrected.
- `catalog.json`, `catalog.csv`, `acquisition_report.json`,
  `license_manifest.csv`, `checksums.sha256`, `gallery.html`, `handoff.md`, and
  `validation_report.json` exist and agree on counts.
- Validation reports no broken paths, missing assets, or unrecorded failures.
- The handoff states that the collection is local, contains IKEA-controlled
  material, is for personal research/learning only, and must not be redistributed
  or commercially used without permission.

Report the collection path, successful and failed counts, dimension coverage,
validation result, gallery URL if served, and remaining limitations.
