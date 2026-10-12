// Weather + sunrise/sunset from Open-Meteo (free, no key). Used for "is it dark?" and "is it raining?".
const { URLS } = require('./config');
const { getJSON } = require('./http');
const { cached } = require('./cache');

const CONDITION = (c) => (c <= 1 ? 'Clear' : c === 2 ? 'Partly cloudy' : c === 3 ? 'Cloudy' : c === 45 || c === 48 ? 'Fog' : c >= 51 && c <= 67 ? 'Rain' : c >= 71 && c <= 77 ? 'Snow' : c >= 80 && c <= 82 ? 'Showers' : c >= 95 ? 'Thunderstorm' : 'Cloudy');
const hhmm = (s) => { const m = /T(\d\d):(\d\d)/.exec(s || ''); return m ? +m[1] + +m[2] / 60 : null; };
const istNow = () => { const d = new Date(Date.now() + 5.5 * 3600e3); return d.getUTCHours() + d.getUTCMinutes() / 60; };

async function weatherAt(lat, lng) {
  const key = `wx:${lat.toFixed(1)}:${lng.toFixed(1)}`;
  try {
    return await cached(key, 15 * 60e3, async () => {
      const j = await getJSON(`${URLS.meteo}/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,precipitation,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`, {}, 8000);
      const c = j.current || {}, code = c.weather_code;
      return { tempC: c.temperature_2m, precip: c.precipitation || 0, code, condition: CONDITION(code), isDay: c.is_day === 1,
        bad: (c.precipitation || 0) > 0.1 || (code >= 51 && code <= 67) || (code >= 80 && code <= 99) || code === 45 || code === 48,
        sunrise: hhmm(j.daily && j.daily.sunrise && j.daily.sunrise[0]), sunset: hhmm(j.daily && j.daily.sunset && j.daily.sunset[0]), localHour: hhmm(c.time) };
    });
  } catch (e) { return null; }       // weather is a bonus: never block a route because of it
}
module.exports = { weatherAt, istNow };
