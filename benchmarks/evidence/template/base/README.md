# {{name}}

This repository is an application generated from the complete frozen Markdown subject corpus under `docs/analysis/`. It contains a runnable NestJS, Nestia, Prisma SQLite, React, Vite, and Playwright workspace. Requirement-derived schema, routes, behavior, tests, and screens are intentionally left for the coding agent. The infrastructure-only `GET /health` probe is already wired through its Nest controller, generated typed SDK accessor, and live backend e2e assertion so the shared runtime has one verified starting contract.

The scaffold was adapted from `wrtnlabs/autobe-mcp` commit `bf7d0373de9cae932c111a5b9141020f3afc1019`. AutoBE-specific MCP servers, compiler ownership guards, resident state, lint rules, Hallmark skills, PostgreSQL assets, and throughput benchmarks are deliberately excluded.

## Commands

```bash
pnpm install
cp packages/backend/.env.example packages/backend/.env
pnpm build
pnpm lint
pnpm schema:database
pnpm test
pnpm format
```

The backend `.env` is required for local server and test processes. The frontend already has working defaults; copy `packages/frontend/.env.example` to `packages/frontend/.env` only when overriding them.

Run `pnpm schema:database` after changing the Prisma schema. This workspace uses disposable SQLite data, so the command resets the local database. Install Chromium once with `pnpm --filter {{frontendPackageName}} playwright:install` before running the browser suite.

The included GitHub Actions workflow performs a frozen install, build, lint, SQLite preparation, backend tests, and Chromium frontend tests on every push and pull request. It uses only local CI environment values and requires no repository secrets.
