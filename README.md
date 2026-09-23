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

**Each new pin**

1. Add a row: `name`, `map_link` (a Google Maps "Share" link), `rating`,
   `drink`, `note`, `ig` (the Instagram post URL). `address` is optional.
2. In the sheet menu: **Thumbs Up Coffee → Fill coordinates for new rows**.
3. That's it — the map shows the pin within a few minutes.

Photos are optional. Put an image URL in the `thumb` column to show the post
photo (in the pin and the card); leave it blank for the coffee-cup placeholder.

## Embed on the blog (Squarespace)

Add a **Code** block and paste:

```html
<iframe src="https://chongmindev.github.io/thumbsup-coffee-map/"
  style="width:100%;height:600px;border:0;border-radius:12px"
  loading="lazy" title="Thumbs Up Coffee Map"></iframe>
```

## Files

- `index.html` — the map
- `sheet-geocoder.gs` — paste into the sheet; fills coordinates for you
- `data-template.csv` — starter columns for the sheet
- `images/` — pin and card photos
