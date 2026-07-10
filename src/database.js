const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { RequestStatus, StatusLabels } = require('./domain');

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tracking.sqlite');

function createDatabase(filePath = DEFAULT_DB_PATH) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      position_id INTEGER NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (position_id) REFERENCES positions(id)
    );

    CREATE TABLE IF NOT EXISTS request_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      assignee_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status_id INTEGER NOT NULL,
      FOREIGN KEY (author_id) REFERENCES employees(id),
      FOREIGN KEY (assignee_id) REFERENCES employees(id),
      FOREIGN KEY (status_id) REFERENCES request_statuses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status_id);
    CREATE INDEX IF NOT EXISTS idx_requests_assignee ON requests(assignee_id);
  `);
}

function insertReferenceData(db) {
  const departments = [
    'IT',
    'Финансы',
    'Продажи',
    'HR',
    'Логистика',
    'Поддержка',
    'Маркетинг',
    'Юридический отдел'
  ];
  const positions = [
    'Специалист',
    'Ведущий специалист',
    'Инженер',
    'Менеджер',
    'Аналитик',
    'Администратор'
  ];

  const insertDepartment = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
  const insertPosition = db.prepare('INSERT OR IGNORE INTO positions (name) VALUES (?)');
  const insertStatus = db.prepare(`
    INSERT OR IGNORE INTO request_statuses (id, code, name, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  departments.forEach((name) => insertDepartment.run(name));
  positions.forEach((name) => insertPosition.run(name));
  [
    [1, RequestStatus.NEW, StatusLabels[RequestStatus.NEW], 1],
    [2, RequestStatus.IN_PROGRESS, StatusLabels[RequestStatus.IN_PROGRESS], 2],
    [3, RequestStatus.DONE, StatusLabels[RequestStatus.DONE], 3]
  ].forEach((row) => insertStatus.run(...row));
}

function resetData(db) {
  db.exec(`
    DELETE FROM requests;
    DELETE FROM employees;
    DELETE FROM departments;
    DELETE FROM positions;
    DELETE FROM request_statuses;
  `);
}

function seedDemoData(db, { employeeCount = 40, requestCount = 120 } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM employees').get().count;
  if (existing > 0) {
    return;
  }

  insertReferenceData(db);

  const departmentIds = db.prepare('SELECT id FROM departments ORDER BY id').all().map((row) => row.id);
  const positionIds = db.prepare('SELECT id FROM positions ORDER BY id').all().map((row) => row.id);
  const insertEmployee = db.prepare(`
    INSERT INTO employees (id, full_name, department_id, position_id)
    VALUES (?, ?, ?, ?)
  `);
  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, number, created_at, author_id, assignee_id, description, due_date, status_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (let i = 1; i <= employeeCount; i += 1) {
      insertEmployee.run(
        i,
        `Сотрудник ${String(i).padStart(4, '0')}`,
        departmentIds[(i - 1) % departmentIds.length],
        positionIds[(i - 1) % positionIds.length]
      );
    }

    for (let i = 1; i <= requestCount; i += 1) {
      const statusId = (i % 3) + 1;
      const dueDay = String((i % 28) + 1).padStart(2, '0');
      const dueMonth = i % 4 === 0 ? '06' : '07';
      insertRequest.run(
        i,
        `REQ-${String(i).padStart(7, '0')}`,
        '2026-07-10',
        ((i + 2) % employeeCount) + 1,
        ((i + 5) % employeeCount) + 1,
        `Тестовая заявка ${i}`,
        `2026-${dueMonth}-${dueDay}`,
        statusId
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function createOptimizedRequestIndex(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_requests_assignee_status_due
    ON requests(assignee_id, status_id, due_date);
  `);
}

function dropOptimizedRequestIndex(db) {
  db.exec('DROP INDEX IF EXISTS idx_requests_assignee_status_due;');
}

module.exports = {
  DEFAULT_DB_PATH,
  createDatabase,
  createOptimizedRequestIndex,
  createSchema,
  dropOptimizedRequestIndex,
  insertReferenceData,
  resetData,
  seedDemoData
};
