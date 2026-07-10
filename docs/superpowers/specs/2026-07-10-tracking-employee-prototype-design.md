# Tracking Employee Prototype Design

## Goal

Build a small but complete web application for employee request tracking. The app must demonstrate the business process, normalized SQL storage, object-oriented domain rules, reports, and a measurable database optimization.

## Scope

The application uses one operator role. The operator can view employees, create requests, filter requests, change the request assignee, and move a request through the allowed status workflow.

Access roles, manager approval, multiple assignees, status history, request types, and dynamic due dates are documented as extension points in the README instead of implemented in the prototype.

## Architecture

The project uses Node.js with the built-in `node:sqlite` module and plain HTML/CSS/JavaScript. The backend exposes JSON API endpoints over Node's built-in HTTP server, so no external packages are required.

The domain model is isolated from persistence. `EmployeeRequest` owns the workflow rule `New -> In Progress -> Done`. Repositories handle SQLite reads and writes. The browser app consumes the API and renders a practical operator dashboard.

## Database

The SQLite schema is normalized into:

- `departments`
- `positions`
- `employees`
- `request_statuses`
- `requests`

Requests reference employees and statuses by foreign keys. Employees reference departments and positions. This avoids repeating department, position, and status text across many request rows.

## Performance Work

The benchmark script creates at least 1000 employees and 1,000,000 requests. It measures the query for overdue requests assigned to one employee and currently in `In Progress`, sorted by due date.

The script first measures without the optimized composite index. It then creates an index on `(assignee_id, status_id, due_date)` and repeats the query. The README records why that index helps and where the latest measured results are printed.
