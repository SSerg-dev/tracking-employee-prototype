const state = {
  employees: [],
  departments: [],
  requests: []
};

const statusNext = {
  new: 'in_progress',
  in_progress: 'done'
};

const statusButton = {
  new: 'В работу',
  in_progress: 'Выполнить'
};

const statusClass = {
  new: 'status-new',
  in_progress: 'status-in_progress',
  done: 'status-done'
};

const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:3000' : '';

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Ошибка запроса');
  }
  return payload;
}

async function init() {
  await loadEmployees();
  bindEvents();
  setDefaultDate();
  await refreshAll();
}

async function loadEmployees() {
  state.employees = await api('/api/employees');
  state.departments = Array.from(
    new Map(state.employees.map((employee) => [employee.departmentId, employee.departmentName])).entries()
  );

  fillEmployeeSelect(document.querySelector('#authorId'));
  fillEmployeeSelect(document.querySelector('#assigneeId'));
  fillEmployeeSelect(document.querySelector('#assigneeFilter'), 'Все исполнители');

  const departmentFilter = document.querySelector('#departmentFilter');
  departmentFilter.innerHTML = '<option value="">Все подразделения</option>';
  const byDepartment = new Map();
  state.employees.forEach((employee) => {
    if (!byDepartment.has(employee.departmentId)) {
      byDepartment.set(employee.departmentId, employee.departmentName);
    }
  });
  Array.from(byDepartment.entries()).sort((left, right) => left[1].localeCompare(right[1])).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    departmentFilter.append(option);
  });
}

function fillEmployeeSelect(select, emptyLabel) {
  select.innerHTML = emptyLabel ? `<option value="">${emptyLabel}</option>` : '';
  state.employees.forEach((employee) => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = `${employee.fullName} - ${employee.departmentName}`;
    select.append(option);
  });
}

function bindEvents() {
  document.querySelector('#requestForm').addEventListener('submit', createRequest);
  document.querySelector('#refreshButton').addEventListener('click', refreshAll);
  ['#statusFilter', '#assigneeFilter', '#departmentFilter', '#overdueFilter'].forEach((selector) => {
    document.querySelector(selector).addEventListener('change', loadRequests);
  });
}

function setDefaultDate() {
  document.querySelector('#dueDate').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

async function refreshAll() {
  await Promise.all([loadRequests(), loadReports()]);
}

async function createRequest(event) {
  event.preventDefault();
  const message = document.querySelector('#formMessage');
  try {
    await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        authorId: Number(document.querySelector('#authorId').value),
        assigneeId: Number(document.querySelector('#assigneeId').value),
        dueDate: document.querySelector('#dueDate').value,
        description: document.querySelector('#description').value
      })
    });
    event.target.reset();
    setDefaultDate();
    message.textContent = 'Заявка создана.';
    await refreshAll();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadRequests() {
  const params = new URLSearchParams();
  const status = document.querySelector('#statusFilter').value;
  const assigneeId = document.querySelector('#assigneeFilter').value;
  const departmentId = document.querySelector('#departmentFilter').value;
  const overdueOnly = document.querySelector('#overdueFilter').checked;

  if (status) params.set('status', status);
  if (assigneeId) params.set('assigneeId', assigneeId);
  if (departmentId) params.set('departmentId', departmentId);
  if (overdueOnly) params.set('overdueOnly', 'true');
  params.set('limit', '50');

  const result = await api(`/api/requests?${params.toString()}`);
  state.requests = result.items;
  document.querySelector('#totalRequests').textContent = `Найдено: ${result.total}`;
  renderRequests();
}

function renderRequests() {
  const body = document.querySelector('#requestsBody');
  body.innerHTML = '';

  state.requests.forEach((request) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(request.number)}</td>
      <td>${escapeHtml(request.description)}</td>
      <td>${escapeHtml(request.authorName)}</td>
      <td>${escapeHtml(request.assigneeName)}</td>
      <td>${escapeHtml(request.departmentName)}</td>
      <td class="${request.isOverdue ? 'overdue' : ''}">${escapeHtml(request.dueDate)}</td>
      <td><span class="status ${statusClass[request.statusCode]}">${escapeHtml(request.statusName)}</span></td>
      <td></td>
    `;

    row.lastElementChild.append(renderActions(request));
    body.append(row);
  });
}

function renderActions(request) {
  const wrap = document.createElement('div');
  wrap.className = 'row-actions';

  const select = document.createElement('select');
  fillEmployeeSelect(select);
  select.value = request.assigneeId;
  select.addEventListener('change', async () => {
    await api(`/api/requests/${request.id}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId: Number(select.value) })
    });
    await refreshAll();
  });
  wrap.append(select);

  if (statusNext[request.statusCode]) {
    const button = document.createElement('button');
    button.textContent = statusButton[request.statusCode];
    button.addEventListener('click', async () => {
      try {
        await api(`/api/requests/${request.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: statusNext[request.statusCode] })
        });
        await refreshAll();
      } catch (error) {
        alert(error.message);
      }
    });
    wrap.append(button);
  }

  return wrap;
}

async function loadReports() {
  const summary = await api('/api/reports/summary');
  const metrics = document.querySelector('#metrics');
  const statusCards = summary.byStatus.map((item) => `
    <article class="metric">
      <span>${escapeHtml(item.name)}</span>
      <strong>${item.count}</strong>
    </article>
  `).join('');

  metrics.innerHTML = `
    ${statusCards}
    <article class="metric">
      <span>Просрочено</span>
      <strong>${summary.overdueCount}</strong>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

init().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.stack || error.message)}</pre>`;
});
