/**
 * Thumbs Up Coffee Map — sheet geocoder
 * ---------------------------------
 * Fills the lat/lng columns for you so you never type coordinates. Two ways to
 * add a cafe's location, per row:
 *
 *   A) EASIEST — paste a map "share" link into the `map_link` column.
 *      In Google Maps: find the cafe -> Share -> Copy link -> paste it.
 *      Works with full links and short ones (maps.app.goo.gl / goo.gl/maps);
 *      the script follows the redirect to read the coordinates. No API key
 *      needed for this path.
 *
 *   B) By name — leave `map_link` blank and just fill `name` (+ `area`).
 *      The script looks the cafe up on Kakao. This path needs a free Kakao
 *      REST key (set KAKAO_REST_KEY below); it's more accurate for Korean
 *      cafe names than keyless options.
 *
 * Note: Instagram's own post location tag can't be read automatically (the API
 * was removed and scraping IG is off-limits), which is why we paste a map link.
 *
 * SETUP (once):
 *   1. In your Google Sheet: Extensions -> Apps Script.
 *   2. Delete anything there, paste this whole file. (Optional: add a Kakao
 *      REST key below if you want name-based lookup.)
 *   3. Save. Reload the sheet. A "Thumbs Up Coffee" menu appears.
 *
 * USE (every time you add cafes):
 *   Add rows, then click Thumbs Up Coffee -> "Fill coordinates for new rows".
 *
 * Sheet columns (row 1 headers, exact names, any order):
 *   name | area | map_link | lat | lng | rating | note | ig | thumb
 *   You fill name/ig (+ map_link or area) — the script fills lat/lng.
 */

var KAKAO_REST_KEY = 'PASTE_YOUR_KAKAO_REST_API_KEY_HERE'; // optional (name lookup only)

// Rough bounding box for Korea, to reject numbers that aren't real coords.
var KR_BBOX = { latMin: 33, latMax: 39, lngMin: 124, lngMax: 132 };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Thumbs Up Coffee')
    .addItem('Fill coordinates for new rows', 'geocodeMissing')
    .addItem('Re-fill coordinates for ALL rows', 'geocodeAll')
    .addToUi();
}

function geocodeMissing() { runGeocode_(false); }
function geocodeAll() { runGeocode_(true); }

function runGeocode_(overwrite) {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) { ui.alert('No data rows found.'); return; }

  var header = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var iName = header.indexOf('name');
  var iArea = header.indexOf('area');
  var iLat = header.indexOf('lat');
  var iLng = header.indexOf('lng');
  var iMap = firstIndex_(header, ['map_link', 'maplink', 'map', 'link', 'location']);
  if (iLat < 0 || iLng < 0) {
    ui.alert('The sheet needs columns named: lat, lng (plus name and/or map_link).');
    return;
  }

  var haveKey = KAKAO_REST_KEY && KAKAO_REST_KEY !== 'PASTE_YOUR_KAKAO_REST_API_KEY_HERE';
  var filled = 0, failed = 0, failedNames = [];

  for (var r = 1; r < data.length; r++) {
    var name = iName >= 0 ? String(data[r][iName] || '').trim() : '';
    var link = iMap >= 0 ? String(data[r][iMap] || '').trim() : '';
    if (!name && !link) continue;

    var hasCoords = data[r][iLat] !== '' && data[r][iLng] !== '';
    if (hasCoords && !overwrite) continue;

    var hit = null;

    // A) map link wins if present
    if (link) hit = coordsFromMapUrl_(link);

    // B) fall back to Kakao name lookup
    if (!hit && name && haveKey) {
      var area = iArea >= 0 ? String(data[r][iArea] || '').trim() : '';
      hit = kakaoLookup_([name, area, '서울'].filter(Boolean).join(' '));
    }

    if (hit) {
      sheet.getRange(r + 1, iLat + 1).setValue(hit.lat);
      sheet.getRange(r + 1, iLng + 1).setValue(hit.lng);
      filled++;
    } else {
      failed++;
      failedNames.push(name || link);
    }
    Utilities.sleep(120);
  }

  var msg = 'Filled ' + filled + ' row(s).';
  if (failed) {
    msg += '\nCould not place ' + failed + ': ' + failedNames.join(', ');
    if (!haveKey) msg += '\n(For name-only rows, add a map_link, or set a Kakao key for name lookup.)';
    else msg += '\n(Try pasting a Google Maps share link, or check the name/area.)';
  }
  ui.alert(msg);
}

function firstIndex_(header, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = header.indexOf(names[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

/* ---------------- map-link extraction ---------------- */

function coordsFromMapUrl_(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;

  // Try the link as-is first.
  var hit = parseCoords_(url);
  if (hit) return hit;

  // Short links: follow redirects (server-side) to reach a URL with coords.
  if (/(maps\.app\.goo\.gl|goo\.gl\/maps|naver\.me|kko\.kakao\.com|kko\.to|place\.map\.kakao)/i.test(url)) {
    var resolved = resolveRedirect_(url);
    if (resolved) return parseCoords_(resolved);
  }
  return null;
}

function resolveRedirect_(url) {
  try {
    var current = url;
    for (var hop = 0; hop < 6; hop++) {
      var res = UrlFetchApp.fetch(current, { followRedirects: false, muteHttpExceptions: true });
      var headers = res.getAllHeaders();
      var loc = headers['Location'] || headers['location'];
      if (!loc) {
        // No more redirects; try to find coords in the final page body too.
        var body = res.getContentText();
        return parseCoords_(current) ? current : (parseCoords_(body) ? body : current);
      }
      if (parseCoords_(loc)) return loc;
      current = loc;
    }
    return current;
  } catch (e) {
    return null;
  }
}

function parseCoords_(s) {
  s = String(s || '');
  try { s = decodeURIComponent(s); } catch (e) { /* keep as-is */ }
  var m;
  // Google place's true coords: !3dLAT!4dLNG
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return valid_(m[1], m[2]);
  // Viewport center: @LAT,LNG
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return valid_(m[1], m[2]);
  // Query params: q= / query= / ll= / center= / daddr=
  m = s.match(/[?&](?:q|query|ll|center|daddr|sll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return valid_(m[1], m[2]);
  return null;
}

function valid_(latStr, lngStr) {
  var lat = parseFloat(latStr), lng = parseFloat(lngStr);
  if (lat >= KR_BBOX.latMin && lat <= KR_BBOX.latMax &&
      lng >= KR_BBOX.lngMin && lng <= KR_BBOX.lngMax) {
    return { lat: lat, lng: lng };
  }
  return null;
}

/* ---------------- Kakao name lookup (optional) ---------------- */

function kakaoLookup_(query) {
  return kakaoSearch_(query, true) || kakaoSearch_(query, false);
}

function kakaoSearch_(query, cafesOnly) {
  var url = 'https://dapi.kakao.com/v2/local/search/keyword.json'
    + '?query=' + encodeURIComponent(query)
    + '&size=1'
    + (cafesOnly ? '&category_group_code=CE7' : '');
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'KakaoAK ' + KAKAO_REST_KEY },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  var docs = (JSON.parse(res.getContentText()) || {}).documents || [];
  if (!docs.length) return null;
  return valid_(docs[0].y, docs[0].x); // Kakao: x=lng, y=lat
}
