const { EmployeeRequest, RequestStatus } = require('./domain');

function mapRequest(row) {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.author_name,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    positionName: row.position_name,
    description: row.description,
    dueDate: row.due_date,
    statusId: row.status_id,
    statusCode: row.status_code,
    statusName: row.status_name,
    isOverdue: Boolean(row.is_overdue)
  };
}

class EmployeeRepository {
  constructor(db) {
    this.db = db;
  }

  list() {
    return this.db.prepare(`
      SELECT
        e.id,
        e.department_id AS departmentId,
        e.position_id AS positionId,
        e.full_name AS fullName,
        d.name AS departmentName,
        p.name AS positionName
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      JOIN positions p ON p.id = e.position_id
      ORDER BY e.full_name
    `).all();
  }
}

class RequestRepository {
  constructor(db) {
    this.db = db;
  }

  create({ authorId, assigneeId, description, dueDate }) {
    const nextId = this.db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM requests').get().id;
    const number = `REQ-${String(nextId).padStart(7, '0')}`;
    const statusId = this.getStatusId(RequestStatus.NEW);

    this.db.prepare(`
      INSERT INTO requests (
        id, number, created_at, author_id, assignee_id, description, due_date, status_id
      ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?)
    `).run(nextId, number, authorId, assigneeId, description.trim(), dueDate, statusId);

    return this.getById(nextId);
  }

  getById(id) {
    const row = this.db.prepare(this.baseSelect('WHERE r.id = ?')).get(id);
    if (!row) {
      throw new Error(`Request ${id} not found`);
    }
    return mapRequest(row);
  }

  list({ status, assigneeId, departmentId, overdueOnly, today, limit = 50, offset = 0 } = {}) {
    const where = [];
    const listParams = {
      $today: today || new Date().toISOString().slice(0, 10),
      $limit: limit,
      $offset: offset
    };
    const countParams = {};

    if (status) {
      where.push('s.code = $status');
      listParams.$status = status;
      countParams.$status = status;
    }
    if (assigneeId) {
      where.push('r.assignee_id = $assigneeId');
      listParams.$assigneeId = Number(assigneeId);
      countParams.$assigneeId = Number(assigneeId);
    }
    if (departmentId) {
      where.push('e.department_id = $departmentId');
      listParams.$departmentId = Number(departmentId);
      countParams.$departmentId = Number(departmentId);
    }
    if (overdueOnly) {
      where.push("r.due_date < $today AND s.code != 'done'");
      countParams.$today = listParams.$today;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const items = this.db.prepare(`
      ${this.baseSelect(whereSql)}
      ORDER BY r.due_date ASC, r.id DESC
      LIMIT $limit OFFSET $offset
    `).all(listParams).map(mapRequest);

    const total = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM requests r
      JOIN employees e ON e.id = r.assignee_id
      JOIN request_statuses s ON s.id = r.status_id
      ${whereSql}
    `).get(countParams).total;

    return { items, total };
  }

  changeStatus(id, nextStatus) {
    const current = this.getById(id);
    const request = new EmployeeRequest({
      id: current.id,
      number: current.number,
      createdAt: current.createdAt,
      authorId: current.authorId,
      assigneeId: current.assigneeId,
      description: current.description,
      dueDate: current.dueDate,
      status: current.statusCode
    });

    request.changeStatus(nextStatus);
    const nextStatusId = this.getStatusId(nextStatus);
    this.db.prepare('UPDATE requests SET status_id = ? WHERE id = ?').run(nextStatusId, id);
    return this.getById(id);
  }

  changeAssignee(id, nextAssigneeId) {
    const current = this.getById(id);
    const request = new EmployeeRequest({
      id: current.id,
      assigneeId: current.assigneeId,
      status: current.statusCode
    });
    request.changeAssignee(Number(nextAssigneeId));
    this.db.prepare('UPDATE requests SET assignee_id = ? WHERE id = ?').run(Number(nextAssigneeId), id);
    return this.getById(id);
  }

  getStatusId(code) {
    const row = this.db.prepare('SELECT id FROM request_statuses WHERE code = ?').get(code);
    if (!row) {
      throw new Error(`Unknown status: ${code}`);
    }
    return row.id;
  }

  baseSelect(whereSql) {
    return `
      SELECT
        r.id,
        r.number,
        r.created_at,
        r.author_id,
        author.full_name AS author_name,
        r.assignee_id,
        e.full_name AS assignee_name,
        e.department_id,
        d.name AS department_name,
        p.name AS position_name,
        r.description,
        r.due_date,
        r.status_id,
        s.code AS status_code,
        s.name AS status_name,
        CASE WHEN r.due_date < $today AND s.code != 'done' THEN 1 ELSE 0 END AS is_overdue
      FROM requests r
      JOIN employees author ON author.id = r.author_id
      JOIN employees e ON e.id = r.assignee_id
      JOIN departments d ON d.id = e.department_id
      JOIN positions p ON p.id = e.position_id
      JOIN request_statuses s ON s.id = r.status_id
      ${whereSql}
    `;
  }
}

class ReportRepository {
  constructor(db) {
    this.db = db;
  }

  summary({ today } = {}) {
    const currentDate = today || new Date().toISOString().slice(0, 10);
    return {
      byStatus: this.db.prepare(`
        SELECT s.code, s.name, COUNT(r.id) AS count
        FROM request_statuses s
        LEFT JOIN requests r ON r.status_id = s.id
        GROUP BY s.id
        ORDER BY s.sort_order
      `).all(),
      overdueCount: this.db.prepare(`
        SELECT COUNT(*) AS count
        FROM requests r
        JOIN request_statuses s ON s.id = r.status_id
        WHERE r.due_date < ? AND s.code != 'done'
      `).get(currentDate).count,
      doneByAssignee: this.db.prepare(`
        SELECT e.id AS assigneeId, e.full_name AS assigneeName, COUNT(r.id) AS count
        FROM employees e
        JOIN requests r ON r.assignee_id = e.id
        JOIN request_statuses s ON s.id = r.status_id
        WHERE s.code = 'done'
        GROUP BY e.id
        ORDER BY count DESC, e.full_name
        LIMIT 20
      `).all()
    };
  }
}

class BenchmarkRepository {
  constructor(db) {
    this.db = db;
  }

  queryOverdueInProgressByAssignee({ assigneeId, today, limit = 100 }) {
    return this.db.prepare(`
      SELECT id, number, due_date AS dueDate, description
      FROM requests
      WHERE assignee_id = ?
        AND status_id = 2
        AND due_date < ?
      ORDER BY due_date ASC
      LIMIT ?
    `).all(assigneeId, today, limit);
  }
}

module.exports = {
  BenchmarkRepository,
  EmployeeRepository,
  ReportRepository,
  RequestRepository
};
