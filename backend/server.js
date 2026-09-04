// server.js
// Minimal starter backend for SafePath — connects to safepath.db
// Run: npm install express sqlite3 cors   then   node server.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Make sure safepath.db is placed in the same folder as this file
const db = new sqlite3.Database("./safepath.db", (err) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
  } else {
    console.log("Connected to safepath.db successfully.");
  }
});

// --- Test route: confirms DB connection works ---
app.get("/api/test-users", (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Trusted Contacts for a user ---
app.get("/api/contacts/:userId", (req, res) => {
  db.all(
    "SELECT * FROM trusted_contacts WHERE user_id = ?",
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// --- Nearby safe zones (simple version, no distance filtering yet) ---
app.get("/api/safe-zones", (req, res) => {
  db.all("SELECT * FROM safe_zones", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Submit an incident report ---
app.post("/api/incidents", (req, res) => {
  const { user_id, latitude, longitude, incident_type, description } = req.body;
  db.run(
    `INSERT INTO incident_reports (user_id, latitude, longitude, incident_type, description)
     VALUES (?, ?, ?, ?, ?)`,
    [user_id || null, latitude, longitude, incident_type, description],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Incident reported successfully." });
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SafePath backend running at http://localhost:${PORT}`);
  console.log(`Try it: http://localhost:${PORT}/api/test-users`);
});
