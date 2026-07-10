# Tracking Employee Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable employee request tracking web app with SQLite persistence, domain rules, reports, seed data, and performance benchmarking.

**Architecture:** A dependency-free Node.js HTTP server serves JSON APIs and static files. SQLite persistence is separated from domain workflow logic. A plain JavaScript frontend provides the operator dashboard.

**Tech Stack:** Node.js 22, built-in `node:sqlite`, `node:test`, HTML, CSS, browser JavaScript.

---

### File Structure

- `server.js`: application entrypoint.
- `src/domain.js`: object model and request status transition rules.
- `src/database.js`: SQLite connection, schema creation, seed helpers, index helpers.
- `src/repositories.js`: employee, request, report, and benchmark data access.
- `src/httpApp.js`: HTTP routing, JSON parsing, static file serving.
- `public/index.html`: operator dashboard markup.
- `public/styles.css`: responsive dashboard styling.
- `public/app.js`: browser API client and UI state.
- `scripts/seed.js`: creates demo data for the web app.
- `scripts/benchmark.js`: creates the large benchmark database and measures query speed.
- `test/domain.test.js`: workflow and domain model tests.
- `test/repositories.test.js`: persistence and report tests.
- `README.md`: launch instructions, business process, database design, optimization notes, extension notes.

### Tasks

- [x] Create project metadata, design document, and initial failing domain tests.
- [x] Implement domain model until `test/domain.test.js` passes.
- [x] Add SQLite schema and repository tests.
- [x] Implement database and repositories.
- [x] Add HTTP API and static frontend.
- [x] Add seed and benchmark scripts.
- [x] Write README with business process, rules, DB design, optimization, and launch instructions.
- [x] Run tests and a local smoke test.
