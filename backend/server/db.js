// MongoDB models (Mongoose). Collections: users, contacts, sosevents, checkins.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { MONGODB_URI } = require('./config');

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },     // 10-digit Indian mobile
  email: { type: String, default: '' },
  hash: { type: String, required: true },                    // bcrypt hash, never the password
  tv: { type: Number, default: 0 },                          // token version: changing the password invalidates old logins
  createdAt: { type: Date, default: Date.now }
}));

const Contact = mongoose.model('Contact', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  name: String, phone: String, rel: String,
  order: { type: Number, default: 0 }                        // lowest order = primary contact
}));

const SosEvent = mongoose.model('SosEvent', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  at: { type: Number, default: Date.now },
  lat: Number, lng: Number, reason: String,
  actions: [{ _id: false, ok: Boolean, text: String }],
  messages: [{ _id: false, to: String, phone: String, text: String }],     // the SMS text each contact (and the police) receives
  police: Schema.Types.Mixed                                               // nearest police station found
}));

const Checkin = mongoose.model('Checkin', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  end: { type: Number, required: true },                     // ms timestamp
  status: { type: String, default: 'active', index: true },  // active | confirmed | sos | replaced
  lat: Number, lng: Number
}));

// Community reports of unsafe places (feeds the risk model)
const Report = mongoose.model('Report', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lat: { type: Number, index: true }, lng: Number,
  type: { type: String, default: 'other' },      // harassment | poor_lighting | isolated | stalking | theft | other
  note: { type: String, default: '' }, at: { type: Number, default: Date.now }
}));

// Evidence recorded automatically during an SOS (front-camera video + audio, GPS track, timestamps)
const Evidence = mongoose.model('Evidence', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  sosId: String, file: String, size: Number, mime: String,
  startedAt: Number, endedAt: Number, uploadedAt: { type: Number, default: Date.now },
  track: [{ _id: false, lat: Number, lng: Number, t: Number }]
}));

// Cache for OpenStreetMap / weather answers = our "safe-zone database" (so repeated requests are instant and work if a free server is slow)
const Cache = mongoose.model('Cache', new Schema({
  key: { type: String, unique: true, required: true }, value: Schema.Types.Mixed, expiresAt: Number
}));

async function connect(uri = MONGODB_URI, timeoutMs = 6000) {
  try { await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs }); }
  catch (e) { await mongoose.disconnect().catch(() => {}); throw e; }
  await Promise.all([User.init(), Contact.init(), SosEvent.init(), Checkin.init(), Report.init(), Evidence.init(), Cache.init()]);   // create indexes
  return mongoose.connection;
}
const contactsOf = uid => Contact.find({ userId: uid }).sort({ order: 1 });
module.exports = { mongoose, connect, contactsOf, User, Contact, SosEvent, Checkin, Report, Evidence, Cache };
