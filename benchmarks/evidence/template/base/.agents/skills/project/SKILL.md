---
name: project
description: Defines the workspace, package boundaries, generated artifacts, phase order, compiler gates, development processes, and canonical commands. Read before choosing where to work or which command to run.
---

# Project

## Product

This repository implements every requirement under `docs/analysis/` as a NestJS backend, generated Nestia SDK, and React application. The requirement documents are immutable input. A compiling stub, an unreachable endpoint, or an untested behavior is incomplete.

The scaffold already provides package wiring, lint and compiler configuration, SQLite setup, `/health`, and a frontend shell. Requirement-derived models, contracts, logic, tests, screens, and journeys are yours to implement.

## Packages

| Path | Owner |
| --- | --- |
| `docs/analysis/` | Immutable requirements |
| `packages/api/src/structures/` | Authored request and response DTOs |
| `packages/api/src/functional/` | Generated SDK accessors |
| `packages/backend/prisma/schema/` | Authored Prisma schema |
| `packages/backend/src/controllers/` | Routes, guards, and delegation |
| `packages/backend/src/providers/` | Business logic and database access |
| `packages/backend/test/features/` | Backend end-to-end tests |
| `packages/frontend/src/` | React application |
| `packages/frontend/src/lib/<domain>/hooks.ts` | The only callers of the generated accessors |
| `packages/frontend/src/components/<domain>/` | Screens and their components |
| `packages/frontend/tests/journeys/` | Browser journeys, run live |
| `packages/frontend/tests/contract/` | Typed-client smoke pass, run under simulation |

Import the API package from its package entry. Do not add a `structures` subpath export or import.

## Phase Order

1. Implement and review the complete API and backend.
2. Implement and review the frontend against the settled SDK and live backend.
3. Review the complete application and run the final runtime gates.

Do not begin frontend implementation before the backend contract and tests pass. A later frontend finding may reopen the backend only when it identifies a specific requirement, contract, diagnostic, test, or integration defect.

## Compiler Gates And Development Processes

- Run `pnpm check:watch` from `packages/backend` with the lifecycle your current objective prescribes. It runs the `test/tsconfig.json` Program, which compiles the backend tests together with the backend source, and reports lint rules and configured contributors for both. The API package checks its own DTOs.
- Start `pnpm dev` from `packages/frontend` before frontend authoring. Keep it running through Overall Final. Vite and `@ttsc/unplugin` report type, lint, and contributor diagnostics on reload.
- Start the backend server with `pnpm dev` from `packages/backend` before live frontend integration. Keep it running through Overall Final.

If a required development process exits, diagnose its output, fix the owning failure, restart it, and wait for a clean current reload. A stale earlier success is not a gate result.

## Generated Artifacts

| Generated artifact | Authored source | Command |
| --- | --- | --- |
| `packages/backend/src/prisma/**` | `packages/backend/prisma/schema/**` | backend `pnpm build:prisma` |
| `docs/ERD.md` | `packages/backend/prisma/schema/**` | backend `pnpm build:prisma` |
| `packages/api/src/functional/**` | controllers and DTOs | backend `pnpm build:sdk` |

Never edit generated output. Correct its authored source and regenerate after the complete source change settles.

## Commands

From `packages/backend`:

```bash
pnpm check:watch
pnpm build:prisma
pnpm schema
pnpm build:sdk
pnpm test
pnpm dev
```

From `packages/frontend`:

```bash
pnpm dev
pnpm test:e2e
pnpm test:contract
```

`pnpm build:prisma` generates the client and ERD. `pnpm schema` resets the disposable SQLite database. `pnpm build:sdk` generates the SDK and compiles the API package. `pnpm test` runs the backend suite. Frontend `pnpm test:e2e` builds the production bundle and runs the live browser journeys; `pnpm test:contract` builds with `--mode contract` and runs the simulated smoke pass.

Follow your current objective's instruction for `check:watch`. Run generators only after their complete authored input settles, and run mutating generators and runtime tests one at a time because they share generated files and the SQLite database.

The workspace-root `pnpm build` and `pnpm test` are Overall-phase commands. Do not use a root build to judge an unfinished layer.

## Toolchain

Compilation and lint run through `ttsc`; tests run through `ttsx`. Do not substitute stock `tsc`, `ts-node`, or ESLint. A stock TypeScript build omits the configured contributor rules.

`pnpm format` rewrites files. It is not a correctness gate.
