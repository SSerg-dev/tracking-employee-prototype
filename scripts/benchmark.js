const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const {
  createDatabase,
  createOptimizedRequestIndex,
  createSchema,
  dropOptimizedRequestIndex,
  insertReferenceData,
  resetData
} = require('../src/database');
const { BenchmarkRepository } = require('../src/repositories');

const dbPath = process.env.BENCHMARK_DB || path.join(process.cwd(), 'data', 'benchmark.sqlite');
const employeeCount = Number(process.env.EMPLOYEES || 1000);
const requestCount = Number(process.env.REQUESTS || 1_000_000);
const targetAssigneeId = Number(process.env.ASSIGNEE_ID || 513);
const today = process.env.TODAY || '2026-07-10';

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = createDatabase(dbPath);

console.log(`Preparing benchmark database: ${dbPath}`);
createSchema(db);
resetData(db);
insertReferenceData(db);
dropOptimizedRequestIndex(db);
seedLargeDataset(db, { employeeCount, requestCount });

const repository = new BenchmarkRepository(db);
const before = measure(() => repository.queryOverdueInProgressByAssignee({
  assigneeId: targetAssigneeId,
  today,
  limit: 200
}));

console.log(`Before optimization: ${before.ms.toFixed(3)} ms, rows: ${before.rows}`);
createOptimizedRequestIndex(db);

const after = measure(() => repository.queryOverdueInProgressByAssignee({
  assigneeId: targetAssigneeId,
  today,
  limit: 200
}));

console.log(`After optimization: ${after.ms.toFixed(3)} ms, rows: ${after.rows}`);
console.log(`Optimization: CREATE INDEX idx_requests_assignee_status_due ON requests(assignee_id, status_id, due_date);`);

function seedLargeDataset(db, { employeeCount, requestCount }) {
  const insertEmployee = db.prepare(`
    INSERT INTO employees (id, full_name, department_id, position_id)
    VALUES (?, ?, ?, ?)
  `);
  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, number, created_at, author_id, assignee_id, description, due_date, status_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const departmentCount = db.prepare('SELECT COUNT(*) AS count FROM departments').get().count;
  const positionCount = db.prepare('SELECT COUNT(*) AS count FROM positions').get().count;

  db.exec('BEGIN');
  try {
    for (let i = 1; i <= employeeCount; i += 1) {
      insertEmployee.run(
        i,
        `Сотрудник ${String(i).padStart(4, '0')}`,
        ((i - 1) % departmentCount) + 1,
        ((i - 1) % positionCount) + 1
      );
    }

    for (let i = 1; i <= requestCount; i += 1) {
      const statusId = i % 5 === 0 ? 3 : (i % 2 === 0 ? 2 : 1);
      const month = i % 4 === 0 ? '06' : '07';
      const day = String((i % 28) + 1).padStart(2, '0');
      const assigneeId = (i % employeeCount) + 1;
      insertRequest.run(
        i,
        `REQ-${String(i).padStart(7, '0')}`,
        '2026-07-10',
        ((i + 17) % employeeCount) + 1,
        assigneeId,
        `Сгенерированная заявка ${i}`,
        `2026-${month}-${day}`,
        statusId
      );

      if (i % 100000 === 0) {
        console.log(`Inserted requests: ${i}`);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function measure(callback) {
  callback();
  const start = performance.now();
  const rows = callback();
  const end = performance.now();
  return { ms: end - start, rows: rows.length };
}
