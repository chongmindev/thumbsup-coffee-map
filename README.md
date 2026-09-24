# Thumbs Up Coffee Map

An embeddable map of coffee shops, one pin per Instagram review.

- Live: https://chongmindev.github.io/thumbsup-coffee-map/
- Pins come from a Google Sheet, so updating the map never needs code.

## How to add a pin

**One-time setup**

1. Make a Google Sheet from `data-template.csv` (File → Import).
2. In the sheet: **Extensions → Apps Script**, paste `sheet-geocoder.gs`, Save.
3. **File → Share → Publish to web → CSV**, copy the link.
4. Paste that link into the `sheetCsvUrl` line in `index.html`, then commit.

**Each new pin** — you only fill two columns:

1. `map_link` — a Google Maps "Share" link for the cafe
2. `ig` — the Instagram post URL

Then run the sheet menu: **Thumbs Up Coffee → Fill details for new rows**. That
fills `lat`, `lng`, `address`, and `area` automatically from the map link. The
map shows the pin within a few minutes.

(`name`, `rating`, `drink`, `note`, `date`, and the photo can come from the
Instagram export — see `data-cafes.csv`.)

**Multiple visits to one cafe:** just add a row per visit with the same `name`.
The map groups them into one pin (with a count badge) and the card gets date
tabs, newest first.

Photos are optional. Put an image URL in `thumb` (or a repo path like
`images/cafe-marie-2026-09-05.jpg`, or a Google Drive share link) to show the
post photo in the pin and card; leave it blank for the coffee-cup placeholder.

## Embed on the blog (Squarespace)

Add a **Code** block and paste:

```html
<iframe src="https://chongmindev.github.io/thumbsup-coffee-map/"
  style="width:100%;height:600px;border:0;border-radius:12px"
  loading="lazy" title="Thumbs Up Coffee Map"></iframe>
```

## Files

- `index.html` — the map
- `sheet-geocoder.gs` — paste into the sheet; fills lat/lng/address/area from a map link
- `data-template.csv` — starter columns for the sheet
- `data-cafes.csv` — the 18 posts from the Instagram export, ready to import
- `images/` — pin and card photos
