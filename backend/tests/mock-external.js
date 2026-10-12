// A fake "internet" for the tests: Overpass, OSRM, Nominatim, Photon, Open-Meteo and an OpenAI-compatible LLM/STT service.
const http = require('http');
const FROM = { lat: 18.1, lng: 83.4 }, TO = { lat: 18.11, lng: 83.41 };
const mock = { transcript: 'hello', llmFail: false, llmCalls: 0, overpassCalls: 0 };

const line = (off, n = 26) => Array.from({ length: n }, (_, i) => { const f = i / (n - 1), bump = Math.sin(Math.PI * f) * off;
  return { lat: FROM.lat + (TO.lat - FROM.lat) * f - bump * 0.7, lng: FROM.lng + (TO.lng - FROM.lng) * f + bump * 0.7 }; });
const A = line(0), B = line(0.004);                        // A = main road (lit, shops, police), B = quiet service road (no lights, no shops)
const geom = (pts) => pts.map((p) => ({ lat: p.lat, lon: p.lng }));
const mid = A[13];

function overpass(body) {
  if (/out center/.test(body)) return { elements: [
    { type: 'node', id: 101, lat: 18.1052, lon: 83.4052, tags: { amenity: 'police', name: 'Test Police Station', phone: '08922-100100' } },
    { type: 'node', id: 102, lat: 18.1058, lon: 83.4040, tags: { amenity: 'hospital', name: 'Test Govt Hospital' } },
    { type: 'node', id: 103, lat: 18.1030, lon: 83.4060, tags: { amenity: 'fuel', name: 'Test Petrol Bunk' } },
    { type: 'node', id: 104, lat: 18.1070, lon: 83.4030, tags: { shop: 'convenience', name: 'Night Mart', opening_hours: '24/7' } },
    { type: 'way', id: 105, center: { lat: 18.1090, lon: 83.4100 }, tags: { shop: 'mall', name: 'Test Mall' } },
    { type: 'node', id: 106, lat: 18.1100, lon: 83.4090, tags: { railway: 'station', name: 'Test Railway Station' } } ] };
  const els = [{ type: 'way', id: 1, tags: { highway: 'primary', lit: 'yes', name: 'Main Road' }, geometry: geom(A) },
    { type: 'way', id: 2, tags: { highway: 'service' }, geometry: geom(B) },
    { type: 'node', id: 11, lat: mid.lat + 0.0002, lon: mid.lng, tags: { amenity: 'police', name: 'Test Police Station' } },
    { type: 'node', id: 17, lat: A[10].lat, lon: A[10].lng + 0.0003, tags: { amenity: 'fuel', name: 'Test Petrol Bunk' } }];
  for (let i = 0; i < 6; i++) els.push({ type: 'node', id: 20 + i, lat: A[6 + i * 2].lat + 0.0002, lon: A[6 + i * 2].lng, tags: { shop: 'supermarket', name: 'Shop ' + i } });
  return { elements: els };
}

let server;
mock.start = (port) => new Promise((resolve) => {
  server = http.createServer((req, res) => {
    let raw = []; req.on('data', (c) => raw.push(c)); req.on('end', () => {
      const body = Buffer.concat(raw).toString('latin1'), u = new URL(req.url, 'http://x'), send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (u.pathname === '/overpass') { mock.overpassCalls++; return send(200, overpass(decodeURIComponent(body))); }
      if (u.pathname.startsWith('/osrm/route/v1/driving/')) return send(200, { routes: [
        { duration: 600, distance: 2400, geometry: { coordinates: A.map((p) => [p.lng, p.lat]) } },
        { duration: 780, distance: 2900, geometry: { coordinates: B.map((p) => [p.lng, p.lat]) } } ] });
      if (u.pathname === '/nominatim/search') return send(200, /nowhere/i.test(u.searchParams.get('q')) ? [] : [{ lat: String(TO.lat), lon: String(TO.lng), display_name: 'Test Bus Stand' }]);
      if (u.pathname === '/photon/api/') return send(200, { features: [] });
      if (u.pathname === '/openmeteo/v1/forecast') return send(200, { current: { time: '2026-10-11T12:00', temperature_2m: 30, precipitation: 0, weather_code: 1, is_day: 1 }, daily: { sunrise: ['2026-10-11T06:05'], sunset: ['2026-10-11T17:55'] } });
      if (u.pathname === '/llm/chat/completions') {
        mock.llmCalls++; if (mock.llmFail) return send(500, { error: 'down' });
        const last = JSON.parse(body).messages.slice(-1)[0].content;
        return send(200, { choices: [{ message: { content: /followed/i.test(last) ? '[SOS] Move to a lit, crowded place now and call 112.' : 'Stay on lit main roads and share your live location.' } }] });
      }
      if (u.pathname === '/llm/audio/transcriptions') return send(200, { text: mock.transcript });
      send(404, { error: 'mock: ' + u.pathname });
    });
  }).listen(port, '127.0.0.1', resolve);
});
mock.stop = () => server.close();
module.exports = { mock, FROM, TO, A, B };
