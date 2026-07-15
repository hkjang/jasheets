# JaSheets Product Roadmap

## Product Goal

JaSheets should provide a reliable, collaborative spreadsheet core before expanding into automation and AI. Google Sheets parity is a multi-release product goal, not a single feature: correctness, data durability, permissions, accessibility, and performance are release gates for every phase.

## Current Baseline

The repository already contains a canvas spreadsheet, formula engine, charts and pivot logic, import/export, comments, Socket.IO collaboration, permissions, revision history, snapshots, automation, PWA scaffolding, admin tooling, and AI-assisted workflows. The highest current risks are cross-platform setup reliability, duplicated client API/auth logic, incomplete offline persistence, sparse automated coverage, and security-sensitive user-generated content.

## Prioritized Delivery

### P0 — Reliability and Security

- Make schema generation, migrations, and seed checks deterministic in CI.
- Replace duplicated `fetch` calls with one typed API client supporting consistent authentication, refresh, cancellation, retries, and structured errors.
- Store refresh tokens as hashes and rotate them on every refresh; add session revocation and rate limits to authentication endpoints.
- Sanitize every HTML/Markdown rendering path and add Content Security Policy headers.
- Add transactional batch cell updates, idempotency keys, optimistic-concurrency versions, and database backup/restore drills.

### P1 — Spreadsheet Correctness

- Expand formula compatibility: absolute/mixed references, named ranges, array formulas, date/time semantics, lookup functions, error propagation, circular-reference detection, and locale-aware parsing.
- Complete row/column insertion and deletion with formula-reference rewriting.
- Add data validation, protected ranges, conditional formatting priority, filter views, find/replace, fill handle, and robust clipboard behavior.
- Build a conformance suite using fixture workbooks and expected computed values.

### P2 — Collaboration and Scale

- Enable development WebSockets, reconnect with missed-operation replay, presence expiry, conflict tests, and observable sync health.
- Move durable edits to an append-only operation log with periodic snapshots and deterministic CRDT reconciliation.
- Add viewport virtualization, worker-based formula calculation, dependency-graph incremental recomputation, and performance budgets for large sheets.

### P3 — User Experience and Ecosystem

- Deliver offline IndexedDB queues with conflict recovery, keyboard-only navigation, screen-reader semantics, localization, and mobile editing.
- Add version diff/restore, granular sharing, publish/embed controls, reusable templates, and accessible charts/pivots.
- Define a sandboxed extension model for macros/UDFs with explicit capabilities, time/memory limits, audit logs, and approval workflows.

## Release Gates

Each release must pass lint, type checks, unit/integration tests, Playwright critical flows, migration tests against a fresh and upgraded database, dependency/security scans, and load tests. Track formula correctness, save latency, sync convergence, crash-free sessions, and recovery success as product-level service indicators.
