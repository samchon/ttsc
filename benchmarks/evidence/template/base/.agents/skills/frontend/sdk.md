# Frontend SDK And Session

## Transport

Call generated accessors directly from domain hooks:

```ts
import * as api from "{{apiPackageName}}";

const page = await api.functional.shopping.customer.sale.index(
  apiConnection,
  { body: { limit: 20 } },
);
```

Never hand-write `fetch`, URLs, request types, response types, or accessor names. Read the generated exports and JSDoc. A missing accessor is an API finding.

Each accessor's JSDoc states its own address as `@accessor api.functional.shopping.customer.sale.index`, alongside the `@controller` and `@path` it came from. That tag is the operation inventory: the complete sorted set of `@accessor` values under `packages/api/src/functional/` is every operation the frontend must consume.

Pure validation or mapping needed identically by frontend and backend comes from `packages/api/src/diagnosers`.

## Shared Connection

`src/lib/client.ts` owns one connection for the current browser actor:

```ts
export const apiConnection: IConnection = {
  host: config.apiHost,
  simulate: config.simulate,
};
```

Authentication accessors write the issued token into this connection. Reuse it for every later call. Do not create connections inside hooks or write a `Bearer` header manually.

Persist the issued token when the contract supports a durable session and restore it onto the shared connection before the first identity-dependent query. Store the response contract, not a parallel local session shape.

## Identity States

Render three states:

| State | UI |
| --- | --- |
| restoring | shell and identity skeleton |
| anonymous | public view and sign-in path |
| authenticated | actor-specific view |

Do not render anonymous during restoration; it flashes the wrong identity and may redirect an authenticated user.

The server decides expiry. Do not decode tokens or run a client timer. If the public contract identifies an expired session and exposes refresh, refresh once and retry once. A failed refresh ends the session.

Sign-out follows the contract. Without server revocation, clear local authorization and every actor-owned query cache. With a revocation operation, call the exact current-session or all-session operation, then clear local state after success.

## Simulation And Live Mode

Drive mode from environment:

```ts
export const config = {
  apiHost: import.meta.env.VITE_API_HOST ?? "http://127.0.0.1:37001",
  simulate: readBoolean(import.meta.env.VITE_API_SIMULATE, false),
} as const;
```

Simulation validates the typed boundary and returns generated response shapes. It does not prove persistence, authorization, sessions, side effects, or deterministic business state.

Simulation is off by default, so the checked-in state of the workspace talks to the backend. The mode turns it on, not a file: `vite.config.ts` sets `VITE_API_SIMULATE` for `--mode contract`, which is what `pnpm test:contract` builds with, and `pnpm dev --mode contract` is the same switch for interactive work. Do not put `VITE_API_SIMULATE` in `packages/frontend/.env`. `vite.config.ts` sets the flag from the mode before Vite reads any env file, so a value there is overwritten rather than honored, and a workspace that relies on it is describing a build it did not get.

Use simulation for screen construction and contract flow. Use fixtures for empty, refusal, boundary, and long-content states. The gate is `pnpm test:e2e` with `VITE_API_SIMULATE=false` against a separately running backend, and `verification.md` owns why the two suites are separate.

Never record a simulated run as live integration.

## Failures

Render contract-declared rejections in the workflow, using `IDiagnosis.accessor` for field placement. Unexpected network and server failures go to a route-level error boundary.

Queries may retry a bounded number of times. Mutations do not retry automatically; replaying a non-idempotent write can duplicate state. Preserve user input after any refusal.
