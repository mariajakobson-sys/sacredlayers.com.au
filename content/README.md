# Original content baseline

`source.json` contains the published Sacred Layers content captured from the six live pages. Treat its wording, punctuation, prices, links and image identity as read-only inputs for redesign work.

- `pages[slug].sections` keeps original section order and identifiers.
- `sections[].blocks` keeps the original Google Sites content-module order. Each block has a stable local `id`, the `sourceId`, its `kind`, exact decoded `text`, preserved `originalHtml`, and clean presentation `html`.
- `textNodes` identifies the original headings, paragraphs and list items with exact decoded text.
- `images` and `backgroundImages` preserve every original source URL. Their `asset` fields point to the unchanged downloaded image files.
- `links` preserve the original targets and labels. `embeds` include the original map iframe decoded from the published Google Sites custom-embed attribute.
- `assets` records the URL, local path, MIME type, byte count and SHA256 digest for every downloaded original image. `browserObservedUrl` and `provenance` connect the original captured URL with the browser page load used to save the same image's bytes.

Clean HTML removes Google Sites controls and presentation metadata while retaining the content text, paragraph/heading structure, line breaks, links and semantic emphasis. Whitespace-only modules are retained in the baseline so original layout scaffolding can be distinguished from written content.

The raw source archives and capture metadata are stored locally in the ignored `../source-snapshots/` folder. They are excluded from GitHub because the full Google Sites documents contain platform runtime configuration unrelated to the authored site content. The retained content modules in `source.json` contain no Google API keys, OAuth clients or session runtime configuration. The extraction uses Python's standard library and requires no website build step. To deliberately recapture the current live site, run `scripts/capture-source.mjs` and `scripts/extract-source.py`. Google Sites serves signed image URLs tied to each page load, so browser resource bundles were used to save the original image bytes. `scripts/import-browser-assets.mjs` imports bundles and DOM image/background slot metadata without resizing, converting or substituting images. Existing preserved files should be reviewed before accepting a later capture.

Run `scripts/verify-preservation.py` to check text equality and original-image byte hashes. Locally retained raw archives are also checked when present. Its result is saved as `verification.json`.
