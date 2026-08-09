# Download and storage contract

## Accepted inputs

- Prefer `--source-file` with an absolute path to a browser-captured GLB.
- Accept `--model-url` only when it was observed in the current browser session,
  uses HTTPS, has no URL credentials, belongs to an official IKEA domain, and
  represents a DIMMA GLB delivery.
- Accept product page URLs only from official IKEA HTTPS domains.

Reject localhost, loopback, link-local, private-network, multicast, or otherwise
non-public destinations. Revalidate every redirect destination. Do not store
cookies, authorization headers, session identifiers, or signed query strings.

## Transfer limits

- Maximum model size: 256 MiB.
- Maximum manually processed redirects: 3.
- Stream data to a temporary file while enforcing the size limit.
- Require an expected model content type when provided; reject HTML, XML, JSON,
  challenge pages, login pages, and other non-model bodies.
- Never retry indefinitely or run concurrent acquisition loops.

## GLB integrity

Require the binary magic `glTF`, version 2, a declared total length equal to the
file length, and a structurally valid JSON chunk. Record used extensions and
report decoder requirements such as Draco mesh or WebP texture support.

Publish only after all checks pass. Use a temporary file in the destination
collection and an atomic rename. Compute SHA-256 before publication. If an asset
with the same digest already exists, return the existing record instead of
creating a duplicate.

## Path confinement

Treat collection IDs, asset IDs, and filenames as untrusted. Reject absolute
output paths, traversal segments, separators, NULs, and resolved paths outside
the configured project-local collection root. Never overwrite an unrelated file.

The original GLB is immutable. Validation, dimension inspection, rendering, and
gallery generation must not rewrite, rescale, optimize, or re-export it.
