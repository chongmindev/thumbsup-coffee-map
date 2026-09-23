# Thumbs Up Coffee Map

An embeddable map of Seoul coffee shops. Each pin links to the Instagram post
that rated it. Built as a single static page (`index.html`) using Leaflet, so it
hosts anywhere and embeds in Squarespace via an `<iframe>`.

- **Most important:** every pin links to its Instagram post.
- **Updatable:** the map reads its pins from a Google Sheet you own. Edit the
  sheet, the map updates. No code, no re-deploy.
- **Preview (optional):** add an image URL in the `thumb` column and the pin +
  popup show it.

---

## 1. Get the data into a Google Sheet

Instagram cannot be scraped for this (against their ToS, and IG does not expose a
post's location). So the cafe list is compiled by hand from the account's posts,
one row per cafe. **You only type the cafe name — coordinates are filled in for
you** (see the geocoder in step 1b).

1. Create a Google Sheet. Put these column headers in **row 1**, exactly:

   | name | area | map_link | lat | lng | rating | drink | note | ig | thumb |
   |------|------|----------|-----|-----|--------|-------|------|----|-------|

   - `name` — the cafe name (e.g. `Fritz Coffee`).
   - `area` — neighborhood, e.g. `강남구 신사`. Shows in the popup; also helps
     name-based lookup.
   - `map_link` — **the easy way to set location.** Paste a map "share" link
     here (see 1b). Leave blank if you'd rather rely on name lookup.
   - `lat` / `lng` — **leave blank.** The script fills these. You can hide these
     two columns.
   - `ig` — the full URL of the Instagram post (e.g. `https://www.instagram.com/p/ABC123/`).
   - `drink` — the drink you rated, shown as a chip (e.g. `Cafe Latte · Hot`). Optional.
   - `note` — the review text shown in the popup. Commas are fine. Optional.
   - `thumb` — optional image URL. Leave blank to show the coffee-cup icon.
   - `rating` — a number like `4.5` (shown as a badge). Optional.

   (`data-template.csv` in this folder has the headers + example rows you can
   import via **File > Import**.)

### 1b. Set locations without typing coordinates

Note: Instagram's post location tag can't be read automatically (IG removed that
API and scraping is off-limits). Instead, you paste a map link — one copy/paste,
no coordinates.

Install the helper once:

1. In the sheet: **Extensions → Apps Script**, delete what's there, paste the
   contents of `sheet-geocoder.gs`, **Save**.
2. Reload the sheet. A **Thumbs Up Coffee** menu appears.
3. *(Optional)* For name-based lookup, get a free **Kakao REST API key** at
   <https://developers.kakao.com> (내 애플리케이션 → 앱 만들기 → 앱 키 → copy the
   *REST API 키*) and paste it into the `KAKAO_REST_KEY` line. Skip this if you
   only paste map links.

**Then, for each cafe — two ways:**

- **A) Paste a map link (easiest, no key).** In Google Maps, find the cafe →
  **Share → Copy link** → paste into `map_link`. Full links and short ones
  (`maps.app.goo.gl/...`) both work.
- **B) By name (needs the Kakao key).** Leave `map_link` blank, just fill `name`
  (+ `area`).

After adding rows, click **Thumbs Up Coffee → Fill coordinates for new rows.** The
`lat`/`lng` columns populate automatically. Anything it can't place is listed so
you can paste a link or fix the name.

### 1c. Publish the sheet so the map can read it

2. **File > Share > Publish to web.** Pick the sheet tab, choose
   **Comma-separated values (.csv)**, click **Publish**, and copy the URL.
   It looks like: `https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv`

3. Open `index.html`, find the `CONFIG` block near the top of the `<script>`, and
   paste that URL:

   ```js
   const CONFIG = {
     sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv"
   };
   ```

Until a URL is set, the map shows built-in sample cafes so it always renders.

> Note: published sheets are cached by Google for a few minutes, so edits appear
> on the map with a short delay.

### 1d. Basemap key (MapTiler)

The map's background tiles come from MapTiler. Keyless tile sources no longer
work for an embed (CARTO watermarks them, Esri lacks Korean street detail, and
OSM.org blocks website use), so a free key is required.

1. Sign up at <https://www.maptiler.com> → **Account → Keys**, copy your key.
2. In the MapTiler dashboard, **restrict the key** to your domains:
   `chongmindev.github.io` and your Squarespace domain. (Client-side keys are
   public; the domain restriction is what stops others using it.)
3. Paste the key into the `CONFIG.maptilerKey` line in `index.html`. Optionally
   change `maptilerStyle` (e.g. `dataviz-light`, `streets-v2`, `basic-v2`).

The free tier (100k tile loads/month) is far more than a blog needs. Without a
key, the map falls back to OSM, which is fine for local preview but not a valid
production embed.

---

## 2. Host it (GitHub Pages, free)

1. Create a GitHub repo and add `index.html` (and this README).
2. Repo **Settings > Pages > Build and deployment**: Source = *Deploy from a
   branch*, Branch = `main`, folder = `/ (root)`. Save.
3. After a minute the page is live at
   `https://<your-username>.github.io/<repo-name>/`.

Any static host works (Netlify drop, Cloudflare Pages, etc.); GitHub Pages is
just the simplest here.

---

## 3. Embed in Squarespace

Squarespace can't run this page's scripts directly in a Code Block, so embed the
hosted page in an `<iframe>`:

1. Edit the blog page > **Add Block > Code** (or Embed).
2. Paste, replacing the URL with your GitHub Pages URL:

   ```html
   <iframe
     src="https://<your-username>.github.io/<repo-name>/"
     style="width:100%; height:600px; border:0; border-radius:12px;"
     loading="lazy"
     title="Thumbs Up Coffee Map">
   </iframe>
   ```

3. Save. (Code Blocks are available on Squarespace Business and Commerce plans.)

To update the map later, just edit the Google Sheet — the embed picks it up
automatically. You only touch Squarespace again if you want to move or resize the
map.

---

## Files

- `index.html` — the whole map (self-contained).
- `data-template.csv` — starter columns + example rows for the Google Sheet.
- `sheet-geocoder.gs` — paste into the sheet's Apps Script so you add cafes by
  name and coordinates fill in automatically.
