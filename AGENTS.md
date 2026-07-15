# Repository Guidelines

## Project Structure & Module Organization

JaSheets is a pnpm/Turborepo monorepo. `apps/web` contains the Next.js frontend (`src/app`, `src/components`, `src/hooks`, and `src/utils`). `apps/api` is the NestJS backend, organized by feature under `src/modules`; Prisma files are in `apps/api/prisma`. Shared libraries live in `packages/shared`, `packages/formula-engine`, and `packages/crdt`. Browser tests are in `e2e/`, Docker configuration in `docker/`, and utilities in `scripts/`.

## Build, Test, and Development Commands

Use Node.js 20+ and pnpm 9. Install dependencies with `pnpm install`.

- `pnpm db:up`: start the development PostgreSQL service.
- `pnpm db:generate` / `pnpm db:migrate`: generate Prisma clients or apply migrations.
- `pnpm dev`: run workspace development servers through Turbo.
- `pnpm build`: build all apps and packages in dependency order.
- `pnpm lint`: run workspace ESLint tasks.
- `pnpm test`: run unit tests across participating workspaces.
- `pnpm test:e2e`: run Playwright tests from `e2e/`.

Run a focused command with pnpm filtering, for example `pnpm --filter web test` or `pnpm --filter api test:cov`.

## Coding Style & Naming Conventions

Use TypeScript and two-space indentation. Backend Prettier requires single quotes and trailing commas; each app's ESLint configuration is authoritative. Use PascalCase for React components and NestJS classes, camelCase for functions and variables, and kebab-case for feature directories (for example, `sheet-permissions/`). Keep controllers, services, modules, and DTOs together by feature. Run linting before submission.

## Testing Guidelines

Jest covers API, web, and formula-engine unit tests; React tests use Testing Library, while Playwright covers browser flows. Name tests `*.spec.ts` or `*.test.ts(x)` and place them in `__tests__` or beside the tested utility. Add regression tests for behavior changes. No fixed coverage threshold is configured; avoid reducing coverage in touched areas.

## Commit & Pull Request Guidelines

History uses Conventional Commit-style subjects such as `feat: Add ...`. Use a concise imperative subject with a prefix (`feat:`, `fix:`, `test:`, `docs:`, or `chore:`) and keep commits focused. Pull requests should explain the change, list verification commands, link issues, call out migrations or environment changes, and include screenshots for visible UI work.

## Security & Configuration

Copy `.env.example` for local setup; never commit credentials or production configuration. Review Prisma migrations and Docker environment changes carefully, and document any new required variables in the matching example file.
