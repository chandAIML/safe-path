// What kind of place is this OpenStreetMap object?
const LABEL = { P: 'Police station', H: 'Hospital / pharmacy', G: 'Petrol bunk', T: 'Metro / railway / bus station', S: '24-hour store', C: 'Crowded public place', F: 'Shop / food' };
const HELP = new Set(['P', 'H', 'G', 'S']);                 // places that can help in an emergency
const CROWD_WEIGHT = { P: 1, H: 1, G: 0.5, T: 2, S: 1, C: 2, F: 1 };

function classify(tags) {
  const a = tags.amenity, s = tags.shop, r = tags.railway, h24 = tags.opening_hours === '24/7';
  if (a === 'police') return 'P';
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'pharmacy') return 'H';
  if (a === 'fuel') return 'G';
  if (r === 'station' || r === 'halt' || r === 'subway_entrance' || tags.public_transport === 'station' || a === 'bus_station') return 'T';
  if (h24 && (s || a)) return 'S';
  if (s === 'mall' || s === 'supermarket' || s === 'department_store' || a === 'marketplace' || a === 'cinema' || a === 'theatre' || a === 'place_of_worship') return 'C';
  if (s || a === 'restaurant' || a === 'fast_food' || a === 'cafe' || a === 'bank' || a === 'atm' || tags.highway === 'bus_stop') return 'F';
  return null;
}
module.exports = { LABEL, HELP, CROWD_WEIGHT, classify };
