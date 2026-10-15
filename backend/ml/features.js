// Features of ONE road segment, used by BOTH the training script and the live server (so they can never disagree).
//   dark      0..1  how dark it is (0 day, 0.5 twilight, 1 night)          lateNight 0/1  between 22:30 and 05:00
//   lit       0..1  street lighting (OSM "lit" tag, else estimated from road type)
//   crowd     0..1  estimated people around (shops/stops nearby x time-of-day activity)
//   roadIso   0..1  how isolated the road type is (main road 0 ... track/path 1)
//   helpFar   0..1  distance to nearest help point (police/hospital/fuel/24h store), 1 = 1.5 km or more
//   crime     0..1  crime-density index of the area            reports 0..1  recent user reports nearby     rain 0/1
const NAMES = ['dark', 'lateNight', 'unlit', 'lowCrowd', 'roadIso', 'helpFar', 'crime', 'reports', 'rain', 'dark x unlit', 'dark x lowCrowd'];
const vector = (f) => [f.dark, f.lateNight, 1 - f.lit, 1 - f.crowd, f.roadIso, f.helpFar, f.crime, f.reports, f.rain, f.dark * (1 - f.lit), f.dark * (1 - f.crowd)];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
module.exports = { NAMES, vector, sigmoid };
