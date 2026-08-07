---
name: api
description: Defines the authored and generated parts of packages/api, its public entry, shared diagnosers, SDK connections, and simulation boundary. Read before editing or importing the API package.
---

# API Package

## Ownership

`packages/api` is the public contract. The backend implements it and the frontend consumes it.

| Path | Ownership |
| --- | --- |
| `src/structures/*.ts` | Authored requirement-derived DTOs |
| `src/typings/**` | Authored transport primitives such as `IEntity`, `IPage`, and `IDiagnosis` |
| `src/diagnosers/**` | Authored pure rules shared by client and server |
| `src/functional/**` | Generated Nestia accessors |

Never edit generated paths. Change controllers or DTOs, then run backend `pnpm build:sdk`.

`src/index.ts` is the only public entry. Export every authored DTO through `src/structures/index.ts` and then the package entry. Import from the package name:

```ts
import * as api from "{{apiPackageName}}";

const page: api.IPage<api.IShoppingSale.ISummary> =
  await api.functional.shopping.customer.sale.index(connection, {
    body: { limit: 20 },
  });
```

Import the package as a namespace, which exposes the accessors and the DTO types through one binding. A default import binds the whole surface under `default`, losing the `api.functional.…` address the accessors document themselves by.

Do not publish or consume `{{apiPackageName}}/structures`. A second export surface creates a second contract path.

## Generated Accessors

Read the generated accessor and its JSDoc instead of guessing from a route. It owns the exact parameters, request, response, simulation branch, and token mutation.

```ts
const page: IPage<IShoppingSale.ISummary> =
  await api.functional.shopping.customer.sale.index(connection, {
    body: { limit: 20 },
  });
```

Never hand-write a URL, cast a namespace to reach a missing member, or redeclare a request or response type. A missing accessor is a contract or generation finding.

## Shared Diagnosers

Place a pure rule in `src/diagnosers` only when frontend and backend must apply the identical rule. Common examples are cross-field validation, entity-to-edit-input mapping, and a shared derivation. Export it from the package and use the same implementation on both sides.

Keep one-sided helpers in their owning package. Publishing a helper nobody outside one package needs expands the contract without a requirement.

## Connections

An SDK connection carries the host, authentication headers, and simulation flag. Authentication lifecycle accessors mutate the connection when their controller JSDoc declares:

```ts
/**
 * @setHeader token.access Authorization
 */
```

```ts
const connection: api.IConnection = { host };
await api.functional.shopping.auth.customer.login(connection, { body });
// Reuse this same authenticated connection.
```

Use one connection per actor. Do not create a fresh connection for the next call or write a `Bearer` header manually. A browser may restore a persisted issued token onto its one shared connection at startup; that is session restoration, not a second authentication mechanism.

## Simulation

Simulation validates the declared request boundary and returns type-correct generated responses:

```ts
const connection: api.IConnection = { host, simulate: true };
```

It proves contract shape and client flow. It does not run providers, persist state, authorize ownership, refresh sessions, or produce deterministic cross-field data. Build frontend flows against simulation and use fixtures for named UI states, then close with the live journey suite under `VITE_API_SIMULATE=false` against the live backend. The two are separate suites, and `.agents/skills/frontend/verification.md` owns why.
