---
name: frontend
description: Defines frontend implementation order, contract use, resident development checking, live integration, and the frontend gate. Read before frontend work, then read every sibling topic.
---

# Frontend

The frontend delivers requirement-backed user journeys through the settled generated SDK. Begin only after the backend gate passes.

## Topics

- [sdk.md](sdk.md): generated accessors, the shared connection, simulation, sessions, and live integration.
- [architecture.md](architecture.md): folders, routes, hooks, state ownership, components, and errors.
- [screens.md](screens.md): screen planning, forms, lists, values, states, and responsive behavior.
- [design.md](design.md): visual discipline and accessibility.
- [verification.md](verification.md): browser journeys, viewports, simulation, live execution, and the verification record.
- [debugging.md](debugging.md): assigning a failure to the runtime and the layer that owns it.

## Implementation Order

1. Read every requirement and all authored and generated API source under `packages/api/src/`.
2. Map requirements and SDK operations to screens in `packages/frontend/wiki/screen-plan.md`, taking the operation list from the `@accessor` tag every generated accessor carries and the requirement list from the enumeration in `screens.md`. `pnpm plan` decides whether the plan accounts for every section.
3. Declare every page and journey surface before implementation.
4. Build the shared shell, primitives, providers, route table, connection, domain hooks, and view models.
5. Implement screens and their loading, empty, error, refusal, retry, and post-mutation states.
6. Write one exported Playwright journey function for every requirement-backed user flow.
7. Run `pnpm test:contract` under simulation while building, and close on `pnpm test:e2e` against the live backend, which its mode builds. The live run is the gate; `verification.md` owns why they are two suites.

Do not turn every endpoint into a page. Do not omit a user capability because it is difficult.

Consumption and presentation are separate obligations. `architecture.md` owns consumption: every published operation is consumed, whatever the interface looks like. A screen decides whether that capability earns its own page — an operation may lack a visible screen only when it is infrastructure, redundant with a complete user path, or non-user-facing, with the exact reason and invalidating condition recorded in `packages/frontend/wiki/omissions.md`. That record answers for the missing page, never for a missing call.

If a requirement needs behavior the SDK cannot express, repair the API or backend, regenerate, and re-pass the backend gate.

## Continuous Development

From `packages/frontend`, start:

```bash
pnpm dev
```

Keep it running through Overall Final. Vite and `@ttsc/unplugin` use the package `tsconfig.json` and `lint.config.ts`, report type, lint, and contributor diagnostics, and reload after input changes.

Use simulation while building contract-shaped screens and deterministic fixtures for named UI states. Before live integration, ensure backend `pnpm dev` is running from `packages/backend`.

## Stack

Use the existing Vite, React, React Router, TanStack Query, Tailwind, generated Nestia SDK, and Playwright stack. Do not add a frontend server, backend-for-frontend, handwritten transport layer, or second API contract.

Add a dependency only after a concrete need appears.

## Frontend Gate

The frontend gate requires:

- the active arm's frontend review;
- a clean current `pnpm dev` reload;
- every requirement-backed journey represented by a browser spec, and every screen walked by one of them;
- every published SDK operation called by a domain hook, and every hook used by a screen;
- every product-facing operation reachable from a screen, or a recorded omission for its missing page;
- `pnpm plan` green, so every requirement section is delivered by a screen entry or decided by an omission;
- every production component consumed by a screen or necessary shared boundary;
- responsive and accessible behavior at required viewports;
- every screen driven in the interactive browser, with `packages/frontend/wiki/interactive-review.md` recording what was observed;
- every requirement journey green under `pnpm test:e2e` against the live backend, each asserting the concrete effect its requirement names; and
- `packages/frontend/wiki/verification.md` recording what actually ran.

A green build proves that the application bundles. It does not prove that users can complete the product.
