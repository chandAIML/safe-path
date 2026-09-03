![SafePath banner](assets/banner.svg)

# SafePath

**An AI-Driven Predictive Personal Safety Mobile Application**

![React Native](https://img.shields.io/badge/Mobile-React_Native-2E86AB?style=flat-square)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2F%20FastAPI-1F4E5F?style=flat-square)
![Machine Learning](https://img.shields.io/badge/AI-ML%20%2B%20GenAI-B03A2E?style=flat-square)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-Academic%20Project-lightgrey?style=flat-square)

SafePath is a mobile safety application that shifts personal safety from *reactive* (manual SOS button) to *proactive and predictive* — warning users before they enter risky areas, detecting distress automatically through voice, and triggering an emergency response without requiring the user to touch their phone.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Timeline](#project-timeline)
- [Team](#team)
- [Getting Started](#getting-started)
- [Folder Structure](#folder-structure)
- [Data Sources](#data-sources)
- [Privacy & Safety Notes](#privacy--safety-notes)
- [License](#license)

---

## Problem Statement

Most existing personal safety apps only act *after* a user manually presses an SOS/panic button. In an actual emergency, finding and unlocking the phone, opening the app, and pressing a button may not be possible. SafePath addresses this gap by combining predictive risk analysis with automatic, hands-free distress detection.

---

## Features

| | Feature | Description |
|---|---|---|
| 🗺️ | **Real-Time Route Risk Prediction** | Scores the safety of a route using crime data, time of day, and crowd density, before the user takes it. |
| 🎙️ | **Voice-Based Distress Detection** | On-device, privacy-preserving detection of screams, panic, or distress keywords (e.g. "Help", "Stop"). Audio never leaves the phone unless a genuine distress pattern is confirmed. |
| 🤖 | **AI Safety Chatbot** | Gives real-time, context-aware guidance when a user describes a threatening situation. |
| 🎥 | **Automatic Evidence Collection** | Auto-starts audio/video recording and logs GPS + timestamp the moment danger is detected. |
| 🚨 | **Emergency Alerts** | Sends live location to pre-added Trusted Contacts and nearby police. |
| 🏥 | **Safe-Zone Recommendations** | Suggests the nearest police station, hospital, or crowded public place via GPS. |
| ⏱️ | **Safe Walk Mode** | User sets a timer while travelling; if they don't check in as "safe," contacts are alerted automatically. |
| 📍 | **Auto Check-In (Geofencing)** | Automatically confirms and notifies contacts once the user reaches their destination safely. |
| 📶 | **Offline SOS (SMS-based)** | Sends emergency alerts even without an internet connection. |
| 🧭 | **Community Incident Map** | Crowdsourced live incident reporting, which also feeds back into the risk-prediction model. |
| 🎭 | **Fake Call & Stealth Mode** | A discreet fake incoming call to de-escalate a threat, and a disguised app interface. |

---

## Tech Stack

- **Mobile App:** React Native
- **Backend:** Node.js / FastAPI
- **APIs & Data:** Maps API, GPS, Crime Data (NCRB / state open-data portals), Crowd-Density Data, Weather & Time Data, SMS Gateway (offline SOS)
- **Databases:** Safe-Zone Database, Community Incident Reports Database
- **AI / ML:**
  - Route Risk Prediction Model
  - On-Device Voice Distress Detection Model
  - Route Safety Scoring Model
  - Generative AI Chatbot

---

## System Architecture

![SafePath architecture](assets/architecture.svg)

---

## Project Timeline

**Duration:** 24 weeks (6 months) | **Reviews:** Weeks 8, 14, 20, and 24

| Weeks | Phase |
|---|---|
| 1–2 | Requirement analysis, planning, tech setup |
| 3–6 | Core app, auth, map/GPS integration, data collection |
| 7–8 | Route risk prediction + safe-zone recommendations *(Review)* |
| 9–12 | Voice distress detection: research, prototype, integration |
| 13–14 | Automatic evidence collection + emergency alerts *(Review)* |
| 15–16 | AI safety chatbot |
| 17–19 | Safe Walk, auto check-in, community map, offline SOS |
| 20 | Fake call & stealth mode *(Review)* |
| 21–22 | Full integration, testing & bug fixing |
| 23–24 | Documentation, final report & demo *(Review)* |

*(See the full 24-week detailed plan document for week-by-week breakdown.)*

---

## Team

| Name | Focus Area |
|---|---|
| Chandini | Mobile UI / Frontend |
| Lavanya | Backend & APIs |
| Mamatha | AI / ML Models |
| Samatha | Integrations & Data |
| Monika | AI Chatbot, Testing & Documentation |

---

## Getting Started

> These are placeholder setup instructions — update once the actual codebase is created.

### Prerequisites
- Node.js (v18+)
- React Native CLI / Expo
- Python 3.10+ (if using FastAPI for ML services)
- A Maps API key (e.g., Google Maps Platform)
- An SMS gateway account (for offline SOS)

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-org>/safepath.git
cd safepath

# Install backend dependencies
cd backend
npm install        # or: pip install -r requirements.txt

# Install mobile app dependencies
cd ../mobile
npm install

# Run the backend
npm run dev

# Run the mobile app
npx react-native run-android   # or run-ios
```

### Environment Variables

Create a `.env` file in `backend/` with:

```
MAPS_API_KEY=your_maps_api_key
SMS_GATEWAY_KEY=your_sms_gateway_key
DATABASE_URL=your_database_connection_string
GENAI_API_KEY=your_chatbot_api_key
```

---

## Folder Structure

```
safepath/
├── mobile/              # React Native app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/
├── backend/              # Node.js / FastAPI server
│   ├── routes/
│   ├── models/
│   └── controllers/
├── ml-models/            # Risk prediction, voice detection, route scoring
│   ├── risk-prediction/
│   ├── voice-detection/
│   └── route-scoring/
├── docs/                 # Reports, abstract, project plan
└── README.md
```

---

## Data Sources

- **Crime Data:** Publicly available government crime records (e.g., NCRB, state police open-data portals)
- **Crowd & Community Data:** In-app, crowdsourced user reports
- **Location Data:** Device GPS (used only during active app use)

---

## Privacy & Safety Notes

- Voice distress detection runs **entirely on-device** — audio is never streamed or stored unless a genuine distress pattern is confirmed.
- Trusted Contacts are added **manually by the user** during setup, not pulled automatically from phone contacts.
- Evidence (audio/video/GPS/timestamp) is only collected when danger is detected or SOS is manually triggered.

---

## License

This project is developed as part of an academic major project. License to be determined by the team/institution.
