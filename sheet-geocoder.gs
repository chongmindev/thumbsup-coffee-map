/**
 * Thumbs Up Coffee Map — sheet geocoder
 * -------------------------------------
 * From a map link, fills: lat, lng, address, and area — so you never type
 * coordinates or addresses.
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
 * USE: fill `map_link`, then Thumbs Up Coffee -> Fill details for new rows.
 * It fills lat/lng/address/area (only where those cells are empty).
 *
 * Columns used: name | map_link | lat | lng | address | area
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Thumbs Up Coffee')
    .addItem('Fill details for new rows', 'geocodeMissing')
    .addItem('Re-fill details for ALL rows', 'geocodeAll')
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
  var iAddr = header.indexOf('address');
  var iArea = header.indexOf('area');
  var iMap = firstIndex_(header, ['map_link', 'maplink', 'map', 'link', 'location']);
  if (iLat < 0 || iLng < 0 || iMap < 0) {
    ui.alert('The sheet needs columns named: map_link, lat, lng.');
    return;
  }

  var located = 0, addressed = 0, failed = 0, failedRows = [];
  for (var r = 1; r < data.length; r++) {
    var link = String(data[r][iMap] || '').trim();
    var hasCoords = data[r][iLat] !== '' && data[r][iLng] !== '';

    // Get coordinates: from the map link, or from coords already in the row.
    var lat, lng;
    if (hasCoords && !overwrite) {
      lat = parseFloat(data[r][iLat]); lng = parseFloat(data[r][iLng]);
    } else if (link) {
      var hit = coordsFromMapUrl_(link);
      if (hit) {
        lat = hit.lat; lng = hit.lng;
        sheet.getRange(r + 1, iLat + 1).setValue(lat);
        sheet.getRange(r + 1, iLng + 1).setValue(lng);
        located++;
      } else if (String(data[r][iName] || '').trim() || link) {
        failed++; failedRows.push(data[r][iName] || ('row ' + (r + 1)));
        continue;
      } else { continue; }
    } else {
      continue; // no link and no coords -> nothing to do
    }
    if (!isFinite(lat) || !isFinite(lng)) continue;

    // Reverse-geocode to fill address / area where empty.
    var needAddr = iAddr >= 0 && (overwrite || String(data[r][iAddr] || '').trim() === '');
    var needArea = iArea >= 0 && (overwrite || String(data[r][iArea] || '').trim() === '');
    if (needAddr || needArea) {
      var info = reverseGeocode_(lat, lng);
      if (info) {
        if (needAddr && info.address) { sheet.getRange(r + 1, iAddr + 1).setValue(info.address); addressed++; }
        if (needArea && info.area) { sheet.getRange(r + 1, iArea + 1).setValue(info.area); }
      }
      Utilities.sleep(1100); // be polite to the geocoder (max ~1 req/sec)
    } else {
      Utilities.sleep(100);
    }
  }

  var msg = 'Located ' + located + ' row(s); filled address on ' + addressed + '.';
  if (failed) msg += '\nCould not read a location for ' + failed + ': ' + failedRows.join(', ') +
    '\n(Paste a Google Maps "Share" link into map_link.)';
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

  // Bare coordinates pasted directly, e.g. "37.5117, 127.0592" — the most
  // reliable option for places whose share link hides the coordinates.
  var bare = url.match(/^\(?\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*\)?$/);
  if (bare) return valid_(bare[1], bare[2]);

  if (!/^https?:\/\//i.test(url)) return null;
  var hit = parseCoords_(url);
  if (hit) return hit;
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
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);            // place's true coords
  if (m) return valid_(m[1], m[2]);
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);                 // @lat,lng
  if (m) return valid_(m[1], m[2]);
  m = s.match(/[?&](?:q|query|ll|center|daddr|sll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return valid_(m[1], m[2]);
  return null;
}

function valid_(latStr, lngStr) {
  var lat = parseFloat(latStr), lng = parseFloat(lngStr);
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng };
  return null;
}

/* ---- reverse geocode coordinates -> address + area (OpenStreetMap/Nominatim) ---- */

function reverseGeocode_(lat, lng) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18'
    + '&accept-language=en&lat=' + lat + '&lon=' + lng;
  try {
    var res = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'thumbsup-coffee-map/1.0 (github.com/chongmindev)' },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    var a = (JSON.parse(res.getContentText()) || {}).address || {};
    var road = [a.house_number, a.road].filter(Boolean).join(' ');
    var hood = a.suburb || a.neighbourhood || a.quarter || '';
    var district = a.city_district || a.borough || a.district || '';
    var city = a.city || a.town || a.state || '';
    var addressParts = [road, hood, district, city].filter(Boolean);
    var seen = {}, address = addressParts.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).join(', ');
    var area = [hood, district || city].filter(Boolean).join(', ');
    return { address: address, area: area };
  } catch (e) {
    return null;
  }
}
