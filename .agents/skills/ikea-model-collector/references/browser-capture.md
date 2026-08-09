# Browser capture workflow

## Codex in-app browser

1. Open the exact user-selected IKEA product page for the intended locale.
2. Confirm the product name, article number, variant, and visible dimensions.
3. Use the page's native 3D/AR control. Observe network activity initiated by
   that interaction.
4. Accept a model only when the browser actually observes an HTTPS `.glb`
   response from an official IKEA host using the DIMMA delivery path.
5. Save the response body to a temporary local file without cookies, request
   headers, tokens, or signed query values.
6. Import it with `add --source-file` and the separately prepared capture JSON.

Do not infer that a page has a model from its category, image, article number,
or another product's URL. Do not synthesize or enumerate DIMMA URLs.

## Other agents

If the agent cannot observe and save browser network responses, ask the user for:

- An absolute path to a GLB they captured during their own product-page session.
- The exact IKEA product page URL and locale.
- Page-visible product identity and dimensions, preferably in a capture JSON.

Use `--source-file`. Do not replace missing browser capability with scraping,
headless crawling, third-party download services, or URL guessing.

## Capture outcomes

- No 3D interaction or GLB response: `model_unavailable`.
- Page or browser could not be inspected: `discovery_failed`.
- A GLB response was observed but could not be saved: `capture_failed`.
- The saved response failed file or GLB checks: `validation_failed`.

Record every requested candidate so the acquisition report shows true coverage.
