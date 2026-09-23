/**
 * Thumbs Up Coffee Map — sheet geocoder
 * -------------------------------------
 * Fills the lat/lng columns from a map link, so you never type coordinates.
 *
 * For each cafe: in Google Maps, find the place -> Share -> Copy link -> paste
 * it into the `map_link` column, then run the menu. Works with full links and
 * short ones (maps.app.goo.gl / goo.gl/maps).
 *
 * SETUP (once):
 *   1. Google Sheet -> Extensions -> Apps Script.
 *   2. Delete anything there, paste this whole file, Save.
 *   3. Reload the sheet. A "Thumbs Up Coffee" menu appears.
 *
 * USE (each time you add cafes):
 *   Fill `map_link`, then: Thumbs Up Coffee -> Fill coordinates for new rows.
 *
 * Columns (row 1 headers): name | map_link | lat | lng | ...
 */

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
  var iLat = header.indexOf('lat');
  var iLng = header.indexOf('lng');
  var iName = header.indexOf('name');
  var iMap = firstIndex_(header, ['map_link', 'maplink', 'map', 'link', 'location']);
  if (iLat < 0 || iLng < 0 || iMap < 0) {
    ui.alert('The sheet needs columns named: map_link, lat, lng.');
    return;
  }

  var filled = 0, failed = 0, failedRows = [];
  for (var r = 1; r < data.length; r++) {
    var link = String(data[r][iMap] || '').trim();
    if (!link) continue;

    var hasCoords = data[r][iLat] !== '' && data[r][iLng] !== '';
    if (hasCoords && !overwrite) continue;

    var hit = coordsFromMapUrl_(link);
    if (hit) {
      sheet.getRange(r + 1, iLat + 1).setValue(hit.lat);
      sheet.getRange(r + 1, iLng + 1).setValue(hit.lng);
      filled++;
    } else {
      failed++;
      failedRows.push(iName >= 0 && data[r][iName] ? data[r][iName] : ('row ' + (r + 1)));
    }
    Utilities.sleep(100);
  }

  var msg = 'Filled ' + filled + ' row(s).';
  if (failed) {
    msg += '\nCould not read a location for ' + failed + ': ' + failedRows.join(', ') +
      '\n(Paste a Google Maps "Share" link into map_link.)';
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

/* ---- extract coordinates from a Google Maps link ---- */

function coordsFromMapUrl_(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;

  var hit = parseCoords_(url);
  if (hit) return hit;

  // Short links: follow the redirect (server-side) to a URL with coordinates.
  if (/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)) {
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
  // Query params: q= / query= / ll= / center= / daddr= / sll=
  m = s.match(/[?&](?:q|query|ll|center|daddr|sll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return valid_(m[1], m[2]);
  return null;
}

function valid_(latStr, lngStr) {
  var lat = parseFloat(latStr), lng = parseFloat(lngStr);
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng };
  return null;
}
