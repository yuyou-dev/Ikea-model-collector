# CLI reference

The Agent Skill normally runs these commands for you. Direct CLI use is available for development and debugging.

In a repository checkout:

```bash
node .agents/skills/ikea-model-collector/scripts/ikea-model-collector.mjs <command> [options]
```

After linking or installing the package, use `ikea-model-collector` instead.

## Commands

```text
init            Create a collection after explicit terms acknowledgement
add             Validate and add a browser-observed or local GLB
record-attempt  Record an unavailable, skipped, or failed candidate
render          Render one or all collection assets with Blender
finalize        Build indexes, reports, checksums, gallery, and handoff
validate        Run the collection completion gate
show            Print a collection summary
serve           Serve the local collection gallery
```

Minimal example:

```bash
CLI=.agents/skills/ikea-model-collector/scripts/ikea-model-collector.mjs

node "$CLI" init \
  --collection-id study \
  --name "IKEA study" \
  --locale en-us \
  --terms-url "https://www.ikea.com/us/en/customer-service/terms-conditions/" \
  --acknowledge-terms

node "$CLI" add \
  --collection-id study \
  --product-url "https://www.ikea.com/..." \
  --source-file /path/to/browser-observed.glb \
  --name "Observed product"

node "$CLI" finalize --collection-id study
node "$CLI" validate --collection-id study
```

Collection output is always confined to `.ikea-model-collector/collections/` under the current project. `--project-dir` is intentionally unsupported.

For capture evidence and advanced fields, see the [browser capture guide](../.agents/skills/ikea-model-collector/references/browser-capture.md) and [download contract](../.agents/skills/ikea-model-collector/references/download-contract.md).
