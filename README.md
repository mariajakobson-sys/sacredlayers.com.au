# Sacred Layers

A modern website for https://www.sacredlayers.com.au, with the original written content and images, sage green **#8E9B86** and white website text, subject to the owner's specific changes described below. The six pages share one responsive design.

## Run locally

Run `npm run dev` with Node.js installed, then open http://127.0.0.1:4173/.

The website supports `/`, `/home`, `/treatments`, `/about`, `/testimonials`, `/partners` and `/contact`. Visit http://127.0.0.1:4173/design-explorer.html for a separate review toolbar with a page selector and desktop/mobile previews at 1280px and 390px. Older preview links with a `design` parameter still open the current website.

## Original content

`content/source.json` holds the original content modules, navigation, links and embedded map. `assets/` holds the original image resources with byte hashes and provenance. The images are copied unchanged, without retouching, conversion or recompression. `content/verification.json` records text and file verification.

Existing punctuation, spelling, prices and phrasing are preserved. At the owner's request, the enquiry-form buttons, Contact's form instructions and the “Begin Your Journey” section are omitted from the website. The original source baseline remains intact so these removals can be reviewed against it.

The footer's Contact link is removed on every page. Contact remains available through the main menu, and its original embedded map is preserved. With the owner's approval, Contact's decorative header photograph is replaced by an abstract circle-and-line composition in the original green. Other original images remain unchanged, and the original Contact image stays in the assets and source baseline.

The owner has also authorized a new “Book Session” link. It opens the external Phorest service-selection page at https://www.phorest.com/salon/revivalhealthlabs/book/service-selection?showSpecialOffers=false. Visitors complete booking there; no enquiry form is included in this website.

The content was captured on 14 October 2026. Raw Google Sites page archives are kept locally in the ignored `source-snapshots/` folder for comparison; the repository contains the authored content modules and original images needed for the redesign. Google Sites editing, reporting and other platform controls are outside the authored page content.

## Presentation and verification

`app.js` renders the content and `site.css` defines the website layout. `design-explorer.html` and `explorer.css` provide review controls outside the website.

Run `python scripts/verify-preservation.py` from the repository root to compare the captured content and verify original image bytes. The check also reads raw page archives when they are available locally. Do not recapture the live site or change the source baseline for a visual update; see `content/README.md` for the source workflow.
