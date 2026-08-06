# Frontend Review Scope

The scope is the frontend: every active acknowledgement in the `frontend-hooks`, `frontend-screens`, and `frontend-journeys` claims.

## Exclusion Carriers

Read both in full:

- `packages/frontend/src/components/SCREEN_EVIDENCE_EXCLUDE.ts`
- `packages/frontend/tests/journeys/JOURNEY_EVIDENCE_EXCLUDE.ts`

`frontend-hooks` has no carrier, and `frontend-screens` accepts an exclusion for a requirement only. An entry excusing an unconsumed operation or an unrendered hook is a finding, and so is one standing in for a screen or journey the requirements ask for.

## Configuration

Compare `packages/frontend/lint.config.ts` with the baseline.

## Gates

Ensure `pnpm dev` is running from `packages/backend` and `packages/frontend`. Their output must contain no diagnostics after the last file change.

Run `pnpm plan` from `packages/frontend`. The claim proves a screen cites a requirement; this proves no requirement section is left without one, which is the direction coverage from the evidence side cannot see.

After the last correction, run `pnpm test:e2e` from `packages/frontend` with `VITE_API_SIMULATE=false` and fix every failure. A clean reload proves the bundle compiles, not that a journey still completes.
