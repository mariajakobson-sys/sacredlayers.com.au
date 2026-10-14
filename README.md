# Sacred Layers design exploration

An exploration of new layouts for https://www.sacredlayers.com.au, keeping the existing written content and original images. The original sage green is **#8E9B86**.

## Preview

Run `npm run dev` with Node.js installed, then open http://127.0.0.1:4173/design-explorer.html.

The review page lets you compare **Editorial & layered**, **Immersive**, and **Clean & classic**, switch between all six pages, and view desktop or mobile layouts. Review controls sit outside the website. The website's content is shared by all three concepts.

This is a design preview. It does not deploy to, replace, or configure the existing domain.

## Original content

- `content/source.json` holds 69 original content modules in order, navigation, links and the embedded map.
- `assets/` holds 14 original image resources with byte hashes and provenance. Images are copied unchanged, without retouching, conversion or recompression.
- `content/verification.json` records exact text and file verification.

Existing punctuation, spelling, prices and phrasing are intentionally preserved. Original Google Sites editing, reporting and other platform interface elements are outside the authored page content.

The content was captured on 14 October 2026. Raw Google Sites page archives are kept locally in the ignored `source-snapshots/` folder for comparison; they are excluded from GitHub because they contain unrelated Google platform configuration. The repository includes the authored content modules and original images needed for the redesign.

## Presentation

`app.js` renders the captured content. `site.css` controls the three layouts. The colour, wording and image sources stay the same across concepts. `design-explorer.html` and `explorer.css` supply the separate review controls.

Navigation retains the selected concept. Treatments use accessible native dropdowns, and the original enquiry form, partner links and contact map remain connected to their original destinations.

## Check preservation

Run `python scripts/verify-preservation.py` from the repository root. It compares each captured source module with its cleaned rendering content and verifies original image bytes. It also checks raw page archives when they are available locally. The browser review additionally checks displayed module text against this baseline.

Do not recapture the live site or update the content baseline as part of a visual-only change. See `content/README.md` for the source workflow.
