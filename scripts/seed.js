const {
  DEFAULT_DB_PATH,
  createDatabase,
  createSchema,
  insertReferenceData,
  resetData,
  seedDemoData
} = require('../src/database');

const db = createDatabase(process.env.DB_PATH || DEFAULT_DB_PATH);
createSchema(db);
resetData(db);
insertReferenceData(db);
seedDemoData(db, {
  employeeCount: Number(process.env.EMPLOYEES || 1000),
  requestCount: Number(process.env.REQUESTS || 10000)
});

console.log('Seed completed.');
