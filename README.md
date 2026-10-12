# SafePath – AI Women Safety App

React Native (Expo) mobile app + Node.js / Express backend + MongoDB.
Runs on your phone with **Expo Go** (scan a QR code). No Google API key, no paid service needed.

## The 7 features (from the project plan) and what is real

| # | Feature | How it works here | Real or simulated |
|---|---|---|---|
| 1 | **Real-time route risk prediction** | For every ~120 m of a route the backend collects: time of day / darkness (Open-Meteo sunrise-sunset), street lighting (OpenStreetMap `lit` tag, else estimated from road type), crowd (shops/stops nearby × hourly activity), isolated roads (road type + distance to help), **crime density**, **user reports**, weather. A **trained logistic-regression model** (`backend/ml/`) turns them into a danger probability → route safety score. | Model, pipeline, lighting, crowd, time, weather, reports = **real**. Crime layer = **simulated demo layer** (no public geotagged crime data exists for Indian cities); real hotspots can be loaded from a CSV. Model is trained on **synthetic data** (expert-prior simulator); real data can be dropped in as CSV. |
| 2 | **Voice-based distress detection** | The phone records 5 s chunks. **Screams**: loudness detected on the phone. **Words** ("help", "stop", "leave me alone", "bachao", "కాపాడండి"…): chunks are sent to Whisper speech-to-text (Groq) and the server checks the words. "stop" counts only if shouted or repeated. | Real. Words need the free `GROQ_API_KEY`; scream detection works without it. Crying/panic *tone* classification is not included (needs a trained audio model). |
| 3 | **AI safety chatbot** | User describes the situation; LLM (Llama via Groq) analyses and suggests steps in English / Telugu / Hindi, knows the time and nearest help, shows an **SOS button** if urgent. Without a key an **offline rule-based advisor** answers. | Real (LLM needs the free key). |
| 4 | **Automatic evidence collection** | When SOS starts: **front camera video + audio** recorded in 20 s clips, **GPS track + timestamps** saved, everything uploaded to the server (`backend/data/evidence`). | Real. Works while the app is open (Expo Go limit). |
| 5 | **Emergency message generation** | Auto-generated text with name, time, live-location link, nearest landmark, nearest police station, her phone number. A separate formal message is prepared for the police. SMS + call to contacts. | Messages are **generated for real**. SMS/call delivery is **simulated** until a Twilio key is added. There is no public police-alert API: the app shows **Call 112**. Offline: a button opens the phone's own SMS app with the message. |
| 6 | **Safe-zone recommendations** | GPS → nearest **police, hospitals/pharmacies, metro/railway/bus stations, petrol bunks, 24-hour stores, crowded public places** (OpenStreetMap), cached in MongoDB (the "safe-zone database"). | Real. |
| 7 | **Predictive alerts before risky areas** | While walking, the app checks the danger level every ~150 m and warns *before* you go deeper ("Risky area: poor lighting, few people. Nearest help: …"). On a planned route, every risky stretch gets an alert shown when you are 300 m away. | Real. |

Also: login with session expiry, profile edit (name / email / phone / password / delete account), emergency contacts, SOS button (hold 2 s + 5 s cancel), check-in timer with server watchdog, shake-to-SOS, evidence & SOS history, community reports.

## Run it
Install once: **Node.js 20+** (nodejs.org) and **Expo Go** on your phone (keep it updated). MongoDB: nothing to install, a built-in one starts by itself (first run downloads it, 1-2 minutes).

```bash
npm run setup     # once
npm start         # every time: starts MongoDB + API + app, prints a QR code
```
Wait for **"SafePath API running on port 5050"**, then scan the QR with Expo Go (Android) or the Camera app (iPhone). Phone and laptop must be on the **same Wi-Fi** (or use your phone's hotspot).

### Turn on the AI chatbot and voice words (free, 2 minutes)
1. https://console.groq.com/keys → sign up (no card) → *Create API key*.
2. Put it in `backend/.env` (created on first run from `.env.example`): `GROQ_API_KEY=gsk_...`
3. Restart `npm start`. The terminal says **"GenAI chatbot + voice words: ON"**.

Without a key everything else works; the chatbot uses the offline advisor and the voice guard detects screams only.

## Demo script for the evaluator (10 minutes)
1. **Register** → add contacts → Home (session stays, no login every time).
2. **Home → "Demo: pretend it is 11 PM"** ON (so night-time risk shows even in daylight).
3. **Plan a safe route** → type a destination ("Vizianagaram RTC bus stand") → show 2-3 routes with **safety scores**, red risky stretches, P/H/G/T/S markers, "Why this score", **predictive alerts**. Tap **Demo drive**: warnings pop up before each risky stretch.
4. **Area safety & nearby safe places** → score ring, factors, nearest police/hospital/petrol/metro; **Report this spot** → plan the route again: the score drops.
5. **AI safety chat** → "Someone is following me" → advice + SOS button. Try Telugu.
6. **Voice & scream guard** ON → say "help" (needs Groq key) or shout.
7. **SOS** (hold 2 s) → 5 s countdown → generated messages for contacts + police, nearest police station, **camera recording** (REC). Show the terminal (`[sms simulated]`).
8. **Evidence & SOS history** → the clips with GPS points; files in `backend/data/evidence`.
9. **Profile** → edit anything, change password.
10. Say the limits honestly (below).

## Honest limitations
- **Crime data is simulated** and the **ML model is trained on synthetic data**. The training code, model file and CSV import are real; with real data the same pipeline works. (`backend/ml/train_risk.js`, `backend/data-seed/README.md`)
- Crowd is an **estimate** (places nearby × time of day), not live footfall. OpenStreetMap lighting tags are sparse in India, so lighting is often estimated from road type (the app says so).
- SMS/call are **simulated** until Twilio keys are added; police cannot be alerted automatically (no public API): the app prepares the message and shows Call 112.
- Voice guard, shake, timers, evidence recording and risk alerts work **while the app is open**. Background / lock-screen protection needs a native build (Android foreground service). The server-side check-in watchdog still covers a dead phone.
- Voice words go to Groq (cloud) for transcription. Offline on-device recognition needs a development build.
- Free map servers (OpenStreetMap, OSRM, Overpass, Open-Meteo, Groq) have rate limits; every request has a backup server and results are cached in MongoDB.

## Tech stack
Mobile: React Native + Expo (Leaflet map in WebView) · Backend: Node.js, Express, Mongoose · DB: MongoDB (users, contacts, sos events, check-ins, reports, evidence, cache) · ML: logistic regression (`backend/ml`) · APIs: OpenStreetMap Overpass (roads, lighting, places), OSRM (routes), Nominatim/Photon (search), Open-Meteo (weather, sunrise/sunset), Groq (Llama chat + Whisper speech-to-text).

## Project structure
```
safepath/
├── package.json  scripts/start.js      # npm run setup / npm start  (QR code)
├── backend/
│   ├── server/   index auth contacts sos checkin   # core
│   │             safety (route plan, risk point, safe zones)  risk (model + analysis)  crime  weather  geo  overpass  zones  poi
│   │             reports chat voice keywords ai evidence  notifier  db config
│   ├── ml/       features.js train_risk.js risk_model.json   # npm run train:risk
│   ├── data-seed/ crime_hotspots.csv (+ README)
│   └── tests/    api.test.js mock-external.js      # npm test  (17 tests, works offline)
└── mobile/
    ├── App.js
    └── src/  api sos evidence voiceGuard riskWatch shake OSMap CheckIn ui theme util geo location native
              screens/  Login Register Contacts Home Route Safety Chat Evidence Profile
```

## Retrain the model with real data
Put `backend/ml/data/training.csv` (columns `dark,lateNight,unlit,lowCrowd,roadIso,helpFar,crime,reports,rain,label`) and run `npm --prefix backend run train:risk`.

## API (all need `Authorization: Bearer <token>` except register, login, health and `/voice/status`)
`POST /auth/register|login` · `GET|PUT|DELETE /auth/me` · `POST /auth/password` · `GET|POST /contacts` · `POST /sos` · `GET|POST /checkin` · `POST /route/plan` · `POST /risk/point` · `GET /safezones` · `GET|POST /reports` · `POST /chat` · `POST /voice/check` · `GET|POST|DELETE /evidence`

## Troubleshooting
| Problem | Fix |
|---|---|
| Port busy / old window | `npm start` now picks the next free port by itself. Close old terminals with Ctrl+C. |
| "Something went wrong" in Expo Go | Fully close Expo Go, `npm start` again (it clears the cache), scan the NEW QR. The app shows its own error text if a screen fails. |
| App can't reach the server | Same Wi-Fi? Windows firewall: allow Node.js. Or Login screen → Server → Change → `http://<laptop-ip>:5050`. |
| Built-in MongoDB can't start | First run needs internet (~100 MB). Or use Atlas (`MONGODB_URI`) / Docker (`docker compose up -d` in backend). |
| Map / routes slow | Free servers; wait up to 30 s or retry. |

MIT License
