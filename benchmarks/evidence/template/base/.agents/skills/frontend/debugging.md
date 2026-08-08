# Debugging

Assign a failure to its owner before editing.

Capture and verification follow [../backend/debugging.md](../backend/debugging.md): keep the exact command and output, repair the owner rather than the symptom, and reproduce the original command before claiming a fix. This document owns only what differs, which is where a frontend failure comes from.

## Two Runtimes

A frontend failure belongs to one of two runtimes, and naming it first removes most of the search.

The application runtime is the browser: rendering, routing, the query cache, and the generated SDK call. The tooling runtime is everything that produced the page: Vite, the resident compiler, the build mode, and the Playwright host that loads a configuration file and starts a preview server.

A tooling failure reports nothing about the product. A configuration file that throws while it loads, a build that never ran, or a preview server that did not start all surface as an empty or absent result, which reads like a passing suite until the count is checked. Read the run's own numbers before reading its assertions.

## Ownership

| Symptom | First owner to inspect |
| --- | --- |
| test run reports zero tests | Playwright configuration load and `testDir` |
| preview server never becomes ready | build output and the port the config reserves |
| journey passes simulated and fails live | fixture shape against the live contract |
| journey passes live and fails simulated | fixture coverage for the same path |
| element present in `pnpm dev` and absent in preview | mode-dependent code or a build the run did not repeat |
| SDK accessor is missing | `packages/api` regeneration, see [../api/SKILL.md](../api/SKILL.md) |
| call rejects with a contract-declared error | the requirement the screen must render, not the transport |
| view keeps a previous filter's rows | query key missing that parameter |
| mutation succeeds and the view does not change | invalidation of every view it changed |
| screen renders its loading state forever | a query whose key never settles, or an unresolved suspense boundary |
| route resolves to the catch-all | route table, then whether the API returned 404 |
| type or lint diagnostic in the editor only | package `tsconfig.json` and `lint.config.ts` the resident compiler reads |
| many failures follow a regenerated SDK | wait for the writer, then the next reload |

## Simulation And Live

The two suites answer different questions, so a failure in one names a different owner than the same failure in the other. [verification.md](verification.md) owns which suite proves what.

Compare the two runs before repairing either. A failure in both is the screen. A failure in one is the boundary between the screen and what stands behind it: the fixture when simulated, the backend or the contract when live.

Repair the boundary at its owner. A fixture edited to match a broken response, or a screen taught to accept a shape the contract does not declare, moves the failure out of sight and leaves the product wrong.
