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

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    console.error(`Open http://127.0.0.1:${port} if the app is already running.`);
    console.error('Or start another instance with a different port, for example:');
    console.error('  PowerShell: $env:PORT=3001; npm run dev');
    console.error('  Bash:       PORT=3001 npm run dev');
    process.exit(1);
  }

  throw error;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`tracking-employee-prototype is running at http://127.0.0.1:${port}`);
});
