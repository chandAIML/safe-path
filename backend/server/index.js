const express = require('express');
const { PORT, MONGODB_URI } = require('./config');
const { connect } = require('./db');
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); next(); });
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./auth').router);
app.use('/api/contacts', require('./contacts').router);
app.use('/api/sos', require('./sos').router);
app.use('/api/checkin', require('./checkin').router);
app.use('/api', require('./safety').router);                  // /route/plan, /risk/point, /safezones
app.use('/api/reports', require('./reports').router);
app.use('/api/chat', require('./chat').router);
app.use('/api/voice', require('./voice').router);
app.use('/api/evidence', require('./evidence').router);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Upload failed: ' + err.message });
  console.error(err); res.status(500).json({ error: 'Server error.' });
});

// Which MongoDB?  1) the one in .env (MONGODB_URI, e.g. Atlas)   2) a MongoDB on this laptop
//                 3) if neither exists: a built-in MongoDB that the app downloads and runs by itself.
let embedded = null;
async function boot() {
  let uri = MONGODB_URI;
  const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(uri);
  try { await connect(uri, local ? 2500 : 8000); }
  catch (e) {
    if (!local) throw e;                      // an Atlas / remote URL was given but failed: tell the user
    console.log('No MongoDB found on this laptop. Starting a built-in MongoDB instead.');
    console.log('(First run downloads it, about 1-2 minutes. Needs internet once. Your data is kept in backend/data/mongo)');
    try { embedded = await require('./embedded').start(); }
    catch (err) { throw new Error('Built-in MongoDB could not start: ' + err.message); }
    uri = embedded.uri; await connect(uri, 20000);
  }
  return uri;
}
async function stopAndExit(code = 0) { try { if (embedded) await embedded.stop(); } catch (e) {} process.exit(code); }

if (require.main === module) {
  boot().then((uri) => {
    console.log('MongoDB connected: ' + uri.replace(/\/\/[^@/]*@/, '//***@'));
    const ai = require('./ai').enabled();
    console.log(ai ? 'GenAI chatbot + voice words: ON (Groq key found)' : 'GenAI chatbot + voice words: OFF (offline advisor is used). Add GROQ_API_KEY to backend/.env to turn them on.');
    app.listen(PORT, '0.0.0.0', () => console.log(`SafePath API running on port ${PORT}`));   // 0.0.0.0 so your phone can reach it
    require('./checkin').start();
  }).catch(async (e) => {
    console.error('\nCould not connect to MongoDB: ' + e.message);
    console.error('Fix: put your Atlas connection string in backend/.env (MONGODB_URI), or install MongoDB / run: docker compose up -d\n');
    await stopAndExit(1);          // exit code 1 so "npm start" notices and stops instead of running without a database
  });
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => stopAndExit(0)));
  process.on('message', (m) => { if (m === 'shutdown') stopAndExit(0); });   // sent by "npm start" so the built-in MongoDB closes cleanly
}
module.exports = app;
