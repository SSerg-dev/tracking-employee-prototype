# tracking-employee-prototype

Prototype web application for tracking employee requests.

## Stack

- Node.js 22
- Built-in `node:sqlite`
- Plain HTML, CSS, JavaScript
- No external npm packages

`node:sqlite` is still marked experimental in Node.js 22, so Node prints an experimental warning during tests and scripts.

## Run

```bash
npm test
npm run seed
npm start
```

Open: <http://127.0.0.1:3000>

The app creates `data/tracking.sqlite` automatically and fills it with demo data if it is empty.

If you run the project from an IDE terminal, these commands are equivalent:

```bash
npm run dev
node dev
```

On Windows, to keep the local server running in the background, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-detached.ps1
```

## Business Process

A request moves through this workflow:

```text
Новая -> В работе -> Выполнена
```

Implemented business rules:

- A new request is always created in status `Новая`.
- A request can move from `Новая` only to `В работе`.
- A request can move from `В работе` only to `Выполнена`.
- A request cannot move from `Новая` directly to `Выполнена`.
- A completed request has no next status in this prototype.
- The assignee can be changed independently of status.

The rule is implemented in the object model in `src/domain.js` and reused by the repository before updating the database.

## Features

- Employee directory with full name, department, and position.
- Request creation with number, creation date, author, assignee, description, due date, and status.
- Request status update with transition validation.
- Request assignee update.
- Request filtering by status, assignee, department, and overdue state.
- Report cards:
  - count by each status;
  - overdue request count;
  - completed requests by assignee in the API report.

## Database Structure

The SQLite schema is normalized:

- `departments(id, name)`
- `positions(id, name)`
- `employees(id, full_name, department_id, position_id)`
- `request_statuses(id, code, name, sort_order)`
- `requests(id, number, created_at, author_id, assignee_id, description, due_date, status_id)`

Why this structure:

- Departments are not duplicated in employee or request rows.
- Positions are stored once and referenced from employees.
- Status values are stored once and referenced from requests.
- Requests keep foreign keys to author, assignee, and status.
- The schema is easier to extend with request types, status history, and permissions.

## Performance Benchmark

Run:

```bash
npm run benchmark
```

The benchmark creates:

- 1000 employees;
- 1,000,000 requests.

Measured query:

```sql
SELECT id, number, due_date, description
FROM requests
WHERE assignee_id = ?
  AND status_id = 2
  AND due_date < ?
ORDER BY due_date ASC
LIMIT ?;
```

Measured target:

- assignee: `513`;
- status: `В работе`;
- due date before `2026-07-10`;
- sorted by due date.

Latest local result:

```text
Before optimization: 24.245 ms, rows: 200
After optimization: 0.862 ms, rows: 200
```

Optimization:

```sql
CREATE INDEX idx_requests_assignee_status_due
ON requests(assignee_id, status_id, due_date);
```

Why it helps:

- `assignee_id` and `status_id` are equality filters, so SQLite can quickly narrow the candidate rows.
- `due_date` is both a range condition and the sort key.
- The composite index matches the query shape and reduces scanning and sorting work.

## Additional Task Notes

If approval by a manager is required:

- add statuses such as `На согласовании` and `Отклонена`;
- add `manager_id` to employees or departments;
- update the transition matrix in the domain model.

If a request can have several assignees:

- replace `requests.assignee_id` with a junction table `request_assignees(request_id, employee_id)`;
- update filters and reports to join through this table.

If status history must be stored:

- add `request_status_history(id, request_id, from_status_id, to_status_id, changed_by_id, changed_at)`;
- write a history row inside the same transaction as a status change.

If due dates depend on request type:

- add `request_types(id, name, sla_hours)`;
- store `type_id` on requests;
- calculate `due_date` from creation time and type SLA.

If access control is required:

- add roles `employee`, `manager`, `admin`;
- add users/accounts table or authentication provider mapping;
- enforce permissions in API routes before repository calls.
