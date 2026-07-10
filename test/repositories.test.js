const test = require('node:test');
const assert = require('node:assert/strict');

const { RequestStatus } = require('../src/domain');
const {
  createDatabase,
  createSchema,
  insertReferenceData,
  seedDemoData
} = require('../src/database');
const { RequestRepository, ReportRepository } = require('../src/repositories');

function setup() {
  const db = createDatabase(':memory:');
  createSchema(db);
  insertReferenceData(db);
  seedDemoData(db, { employeeCount: 8, requestCount: 12 });
  return db;
}

test('creates request and returns it in request list', () => {
  const db = setup();
  const requests = new RequestRepository(db);

  const created = requests.create({
    authorId: 1,
    assigneeId: 2,
    description: 'Подготовить доступ к системе',
    dueDate: '2026-07-20'
  });

  const found = requests.list({ assigneeId: 2, limit: 100 }).items.find((item) => item.id === created.id);

  assert.equal(created.statusCode, RequestStatus.NEW);
  assert.equal(found.description, 'Подготовить доступ к системе');
  assert.equal(found.assigneeId, 2);
});

test('rejects invalid status transition in repository', () => {
  const db = setup();
  const requests = new RequestRepository(db);

  const created = requests.create({
    authorId: 1,
    assigneeId: 2,
    description: 'Проверить прямой переход',
    dueDate: '2026-07-20'
  });

  assert.throws(() => requests.changeStatus(created.id, RequestStatus.DONE), /Invalid status transition/);
});

test('filters overdue requests by status and assignee', () => {
  const db = setup();
  const requests = new RequestRepository(db);
  const created = requests.create({
    authorId: 1,
    assigneeId: 3,
    description: 'Просроченная заявка',
    dueDate: '2026-01-10'
  });
  requests.changeStatus(created.id, RequestStatus.IN_PROGRESS);

  const result = requests.list({
    status: RequestStatus.IN_PROGRESS,
    assigneeId: 3,
    overdueOnly: true,
    today: '2026-07-10'
  });

  assert.equal(result.items.some((item) => item.id === created.id), true);
});

test('builds status and assignee report totals', () => {
  const db = setup();
  const report = new ReportRepository(db);

  const data = report.summary({ today: '2026-07-10' });

  assert.equal(data.byStatus.length, 3);
  assert.equal(typeof data.overdueCount, 'number');
  assert.ok(Array.isArray(data.doneByAssignee));
});
