const fs = require('node:fs');
const path = require('node:path');

const statuses = [
  { id: 1, code: 'new', name: 'Новая' },
  { id: 2, code: 'in_progress', name: 'В работе' },
  { id: 3, code: 'done', name: 'Выполнена' }
];

const departments = ['IT', 'Финансы', 'Продажи', 'HR', 'Логистика', 'Поддержка'];
const positions = ['Специалист', 'Инженер', 'Менеджер', 'Аналитик'];

const state = createDemoState();

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && await serveStatic(pathname, res)) {
      return;
    }

    setJsonHeaders(res);

    if (req.method === 'GET' && pathname === '/api/employees') {
      sendJson(res, 200, state.employees);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/requests') {
      sendJson(res, 200, listRequests(url.searchParams));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/requests') {
      const body = await readJson(req);
      const request = createRequest(body);
      sendJson(res, 201, request);
      return;
    }

    const statusMatch = pathname.match(/^\/api\/requests\/(\d+)\/status$/);
    if (req.method === 'PATCH' && statusMatch) {
      const body = await readJson(req);
      sendJson(res, 200, changeStatus(Number(statusMatch[1]), body.status));
      return;
    }

    const assigneeMatch = pathname.match(/^\/api\/requests\/(\d+)\/assignee$/);
    if (req.method === 'PATCH' && assigneeMatch) {
      const body = await readJson(req);
      sendJson(res, 200, changeAssignee(Number(assigneeMatch[1]), Number(body.assigneeId)));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/reports/summary') {
      sendJson(res, 200, reportSummary());
      return;
    }

    sendJson(res, 404, { error: 'Route not found' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};

async function serveStatic(pathname, res) {
  if (pathname === '/favicon.ico' || pathname === '/favicon.png') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  const staticFiles = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/styles.css': 'styles.css',
    '/app.js': 'app.js'
  };

  const fileName = staticFiles[pathname];
  if (!fileName) {
    return false;
  }

  const publicDir = path.join(process.cwd(), 'public');
  const filePath = path.join(publicDir, fileName);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[path.extname(fileName)] || 'application/octet-stream');
  res.end(fs.readFileSync(filePath));
  return true;
}

function createDemoState() {
  const employees = Array.from({ length: 40 }, (_, index) => {
    const id = index + 1;
    return {
      id,
      fullName: `Сотрудник ${String(id).padStart(4, '0')}`,
      departmentId: (index % departments.length) + 1,
      departmentName: departments[index % departments.length],
      positionId: (index % positions.length) + 1,
      positionName: positions[index % positions.length]
    };
  });

  const requests = Array.from({ length: 120 }, (_, index) => {
    const id = index + 1;
    const status = statuses[index % statuses.length];
    const author = employees[(index + 2) % employees.length];
    const assignee = employees[(index + 5) % employees.length];
    const month = id % 4 === 0 ? '06' : '07';
    const day = String((id % 28) + 1).padStart(2, '0');
    return enrichRequest({
      id,
      number: `REQ-${String(id).padStart(7, '0')}`,
      createdAt: '2026-07-10',
      authorId: author.id,
      assigneeId: assignee.id,
      description: `Тестовая заявка ${id}`,
      dueDate: `2026-${month}-${day}`,
      statusId: status.id,
      statusCode: status.code,
      statusName: status.name
    }, employees);
  });

  return { employees, requests };
}

function listRequests(searchParams) {
  const status = searchParams.get('status');
  const assigneeId = Number(searchParams.get('assigneeId') || 0);
  const departmentId = Number(searchParams.get('departmentId') || 0);
  const overdueOnly = searchParams.get('overdueOnly') === 'true';
  const limit = Number(searchParams.get('limit') || 50);
  const offset = Number(searchParams.get('offset') || 0);
  const today = '2026-07-10';

  let items = state.requests.slice();
  if (status) items = items.filter((request) => request.statusCode === status);
  if (assigneeId) items = items.filter((request) => request.assigneeId === assigneeId);
  if (departmentId) items = items.filter((request) => request.departmentId === departmentId);
  if (overdueOnly) {
    items = items.filter((request) => request.dueDate < today && request.statusCode !== 'done');
  }

  items.sort((left, right) => left.dueDate.localeCompare(right.dueDate) || right.id - left.id);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length
  };
}

function createRequest(body) {
  validateRequired(body, ['authorId', 'assigneeId', 'description', 'dueDate']);
  const nextId = Math.max(...state.requests.map((request) => request.id)) + 1;
  const status = statuses[0];
  const request = enrichRequest({
    id: nextId,
    number: `REQ-${String(nextId).padStart(7, '0')}`,
    createdAt: new Date().toISOString().slice(0, 10),
    authorId: Number(body.authorId),
    assigneeId: Number(body.assigneeId),
    description: String(body.description).trim(),
    dueDate: body.dueDate,
    statusId: status.id,
    statusCode: status.code,
    statusName: status.name
  }, state.employees);

  state.requests.push(request);
  return request;
}

function changeStatus(id, nextStatusCode) {
  const request = findRequest(id);
  const allowed = {
    new: ['in_progress'],
    in_progress: ['done'],
    done: []
  };

  if (!allowed[request.statusCode].includes(nextStatusCode)) {
    const error = new Error('Invalid status transition');
    error.statusCode = 400;
    throw error;
  }

  const status = statuses.find((item) => item.code === nextStatusCode);
  request.statusId = status.id;
  request.statusCode = status.code;
  request.statusName = status.name;
  return request;
}

function changeAssignee(id, assigneeId) {
  const request = findRequest(id);
  const employee = state.employees.find((item) => item.id === assigneeId);
  if (!employee) {
    const error = new Error('Assignee not found');
    error.statusCode = 404;
    throw error;
  }

  request.assigneeId = employee.id;
  request.assigneeName = employee.fullName;
  request.departmentId = employee.departmentId;
  request.departmentName = employee.departmentName;
  request.positionName = employee.positionName;
  return request;
}

function reportSummary() {
  return {
    byStatus: statuses.map((status) => ({
      code: status.code,
      name: status.name,
      count: state.requests.filter((request) => request.statusCode === status.code).length
    })),
    overdueCount: state.requests.filter((request) => request.dueDate < '2026-07-10' && request.statusCode !== 'done').length,
    doneByAssignee: state.employees
      .map((employee) => ({
        assigneeId: employee.id,
        assigneeName: employee.fullName,
        count: state.requests.filter((request) => request.assigneeId === employee.id && request.statusCode === 'done').length
      }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count || left.assigneeName.localeCompare(right.assigneeName))
      .slice(0, 20)
  };
}

function enrichRequest(request, employees) {
  const author = employees.find((employee) => employee.id === request.authorId);
  const assignee = employees.find((employee) => employee.id === request.assigneeId);
  return {
    ...request,
    authorName: author.fullName,
    assigneeName: assignee.fullName,
    departmentId: assignee.departmentId,
    departmentName: assignee.departmentName,
    positionName: assignee.positionName,
    isOverdue: request.dueDate < '2026-07-10' && request.statusCode !== 'done'
  };
}

function findRequest(id) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) {
    const error = new Error('Request not found');
    error.statusCode = 404;
    throw error;
  }
  return request;
}

function validateRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      const error = new Error(`Field "${field}" is required`);
      error.statusCode = 400;
      throw error;
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
  });
}

function setJsonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}
