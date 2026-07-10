const os = require('node:os');
const path = require('node:path');

const {
  createDatabase,
  createSchema,
  insertReferenceData,
  seedDemoData
} = require('../src/database');
const { createRequestHandler } = require('../src/httpApp');

let handler;

function getHandler() {
  if (!handler) {
    const dbPath = process.env.DB_PATH || path.join(os.tmpdir(), 'tracking.sqlite');
    const db = createDatabase(dbPath);

    createSchema(db);
    insertReferenceData(db);
    seedDemoData(db);

    handler = createRequestHandler(db);
  }

  return handler;
}

module.exports = (req, res) => getHandler()(req, res);
