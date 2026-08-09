# Collection and capture schema

## Product capture: `ikea_product_capture.v1`

Use one JSON document per candidate asset. Preserve source facts and normalized
values separately.

```json
{
  "schemaVersion": "ikea_product_capture.v1",
  "name": "Example product",
  "articleNumber": "000.000.00",
  "variant": "color / size",
  "locale": "en-US",
  "productUrl": "https://www.ikea.com/us/en/p/example/",
  "modelUrl": "https://web-api.ikea.com/dimma/assets/example/model.glb",
  "capturedAt": "2026-08-10T00:00:00.000Z",
  "dimensions": {
    "pageRaw": ["Width: 80 cm", "Depth: 40 cm", "Height: 75 cm"],
    "normalizedMeters": {"width": 0.8, "depth": 0.4, "height": 0.75},
    "source": "product-page-visible-text"
  }
}
```

Omit unknown values instead of estimating them. Remove credentials and volatile
signed query values from `modelUrl`; retain enough non-secret provenance to
identify the observed delivery source.

## Geometry enrichment

When Blender inspection is available, store its result in asset metadata without
editing the GLB:

```json
{
  "geometryBoundsMeters": {"x": 0.8, "y": 0.4, "z": 0.75},
  "geometryInspection": {"tool": "Blender", "extensions": []},
  "dimensionMatch": {"status": "match", "tolerance": 0.02}
}
```

Use `match`, `mismatch`, `page_dimensions_missing`, or
`geometry_dimensions_missing`. Report axis ambiguity explicitly. Never silently
scale the model to make dimensions agree.

## Collection layout

```text
<collection>/
├── assets/                   # immutable, verified local GLBs
├── metadata/                 # capture and derived metadata
├── previews/                 # optional generated PNGs and render metadata
├── catalog.json
├── catalog.csv
├── acquisition_report.json
├── license_manifest.csv
├── checksums.sha256
├── gallery.html
├── handoff.md
└── validation_report.json
```

`catalog.json` is the machine-readable source of truth. CSV files support audit
and spreadsheet use. `acquisition_report.json` includes every requested
candidate, including SHA-deduplicated successes and failures. Successful
candidate provenance is stored separately from unique physical assets so two
products sharing one GLB still close the completion gate. `license_manifest.csv` repeats the third-party
rights warning per asset. `checksums.sha256` covers immutable assets.

## Visual and handoff contract

Generate thumbnails with the named `orthographic-shadow-v5` preset when Blender
is available. The local gallery must search and filter the catalog, show preview
fallbacks, and load only local models into a pinned Three.js viewer. It must not
upload assets or call a model service.

The handoff must include counts, category coverage, successful and failed
acquisitions, dimension coverage, checksums, validation status, gallery command,
source locale/terms acknowledgment, known decoder requirements, and the legal
warning from `legal-boundaries.md`.
