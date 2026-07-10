const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { EmployeeRepository, ReportRepository, RequestRepository } = require('./repositories');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

function createServer(db) {
  const employees = new EmployeeRepository(db);
  const requests = new RequestRepository(db);
  const reports = new ReportRepository(db);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        await routeApi({ req, res, url, employees, requests, reports });
        return;
      }

      serveStatic(url.pathname, res);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message || 'Internal server error' });
    }
  });
}

async function routeApi({ req, res, url, employees, requests, reports }) {
  if (req.method === 'GET' && url.pathname === '/api/employees') {
    sendJson(res, 200, employees.list());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/requests') {
    sendJson(res, 200, requests.list({
      status: url.searchParams.get('status') || undefined,
      assigneeId: numberParam(url, 'assigneeId'),
      departmentId: numberParam(url, 'departmentId'),
      overdueOnly: url.searchParams.get('overdueOnly') === 'true',
      limit: numberParam(url, 'limit') || 50,
      offset: numberParam(url, 'offset') || 0
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/requests') {
    const body = await readJson(req);
    validateRequired(body, ['authorId', 'assigneeId', 'description', 'dueDate']);
    sendJson(res, 201, requests.create({
      authorId: Number(body.authorId),
      assigneeId: Number(body.assigneeId),
      description: body.description,
      dueDate: body.dueDate
    }));
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/requests\/(\d+)\/status$/);
  if (req.method === 'PATCH' && statusMatch) {
    const body = await readJson(req);
    validateRequired(body, ['status']);
    sendJson(res, 200, requests.changeStatus(Number(statusMatch[1]), body.status));
    return;
  }

  const assigneeMatch = url.pathname.match(/^\/api\/requests\/(\d+)\/assignee$/);
  if (req.method === 'PATCH' && assigneeMatch) {
    const body = await readJson(req);
    validateRequired(body, ['assigneeId']);
    sendJson(res, 200, requests.changeAssignee(Number(assigneeMatch[1]), Number(body.assigneeId)));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/reports/summary') {
    sendJson(res, 200, reports.summary());
    return;
  }

  sendJson(res, 404, { error: 'Route not found' });
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function numberParam(url, name) {
  const value = url.searchParams.get(name);
  return value ? Number(value) : undefined;
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
      if (raw.length > 1_000_000) {
        reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
      }
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

module.exports = { createServer };
