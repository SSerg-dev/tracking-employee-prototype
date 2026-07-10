const { createServer } = require('./src/httpApp');
const {
  DEFAULT_DB_PATH,
  createDatabase,
  createSchema,
  insertReferenceData,
  seedDemoData
} = require('./src/database');

const port = Number(process.env.PORT || 3000);
const db = createDatabase(process.env.DB_PATH || DEFAULT_DB_PATH);

createSchema(db);
insertReferenceData(db);
seedDemoData(db);

const server = createServer(db);

server.listen(port, '127.0.0.1', () => {
  console.log(`tracking-employee-prototype is running at http://127.0.0.1:${port}`);
});
