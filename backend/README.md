# SafePath Backend — Quick Start

This folder is a ready-to-run starter backend, already connected to `safepath.db`.

## How to run

```bash
cd backend
npm install
node server.js
```

Then open in your browser:
```
http://localhost:3000/api/test-users
```

If you see 3 sample users as JSON, everything is working — backend + database connection confirmed.

## What's included

- `server.js` — the Express server with working routes (users, contacts, safe zones, incidents)
- `safepath.db` — SQLite database with schema + sample data already loaded
- `package.json` — dependencies list
- `routes/`, `controllers/`, `models/`, `config/` — empty folders, ready for you to organize code into as the project grows

## Available routes right now

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/test-users` | Returns all sample users |
| GET | `/api/contacts/:userId` | Returns trusted contacts for a user |
| GET | `/api/safe-zones` | Returns all safe zones |
| POST | `/api/incidents` | Submits a new incident report |

## Next steps

- Test each route in Postman
- Move route logic into `routes/` + `controllers/` as more features are added
- Connect the React Native app to these endpoints
