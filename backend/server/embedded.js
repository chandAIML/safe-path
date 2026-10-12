// Built-in MongoDB (used only when no MongoDB is available). Real mongod, data persisted in backend/data/mongo.
const fs = require('fs'), path = require('path');
const { DATA } = require('./config');

exports.start = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const dbPath = path.join(DATA, 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const m = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
  return { uri: m.getUri('safepath'), stop: () => m.stop({ doCleanup: false }) };
};
