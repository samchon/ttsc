# Evidence Frontend

## Claims

| Claim | Host | References | Declared in |
| --- | --- | --- | --- |
| `frontend-hooks` | exported hook functions | SDK operations | `packages/frontend/lint.config.ts` |
| `frontend-screens` | exported page functions | requirement H2/H3 and hook functions | `packages/frontend/lint.config.ts` |
| `frontend-journeys` | exported journey functions | requirements and page functions | `packages/frontend/lint.config.ts` |

The frontend is one Program and one configuration.

## Claim Chain

A hook cites the operations it calls, a screen cites the hooks it uses, and a journey cites the screens it walks. A hook wrapping an accessor no screen renders satisfies `frontend-hooks` and fails `frontend-screens`.

A hook may cite as many operations as it calls; the obligation is consuming the published surface, not one call per hook.

The operation and hook references refuse `@evidenceExclude` — an unconsumed operation or unused hook is missing work, so write the missing hook or screen instead of excluding it. The requirement and screen references accept a reviewed exclusion.

A journey cites each page it walks as `{@link ThatPage}` resolved through its own type-only import.

## Placement

| Claim | `@evidence` host | Exclusion carrier |
| --- | --- | --- |
| `frontend-hooks` | exported hook function JSDoc | none; operations admit no exclusion |
| `frontend-screens` | exported page function JSDoc | `src/components/SCREEN_EVIDENCE_EXCLUDE.ts`, requirements only |
| `frontend-journeys` | exported journey function JSDoc | `tests/journeys/JOURNEY_EVIDENCE_EXCLUDE.ts` |

Those two carriers are the only place a frontend `@evidenceExclude` may be written:

- `packages/frontend/src/components/SCREEN_EVIDENCE_EXCLUDE.ts`
- `packages/frontend/tests/journeys/JOURNEY_EVIDENCE_EXCLUDE.ts`

Each claim declares its carrier through `evidenceExcludeCarriers`, so an exclusion written anywhere else is a build error naming the file it belongs in. Each carrier ships with a JSDoc block stating what it accepts; read it before adding an entry. `frontend-hooks` declares no carrier at all, and the hook reference of `frontend-screens` refuses one too: an operation no hook calls and a hook no screen renders are missing work, so write the hook or the screen.

## Staged Unlock

Start frontend `pnpm dev` before implementation while every frontend claim is disabled. Unlock each claim in chain order at exactly the point its layer completes — after that layer's last artifact, before the next layer's first. Both directions are wrong, and neither is the safe one:

- **Too early:** the dev process erupts with thousands of evidence errors for hooks, screens, and journeys not yet written, polluting context and burying real diagnostics.
- **Too late:** the chain's obligations arrive as one huge batch after work has moved on. An operation no hook consumes or a screen no journey walks surfaces only then, when fixing it reopens finished layers, and tags retrofitted in bulk drift toward compiler-satisfying filler instead of truthful mappings. Carrying every claim to the end turns the review that follows into the authorship this stage was supposed to finish.

Unlocking on time is what keeps each batch small enough to answer truthfully. A claim opened at its own layer asks about artifacts still in hand; the same claim opened three layers later asks about work already declared done.

1. After every domain hook is complete, delete `disabled` from `frontend-hooks` in `packages/frontend/lint.config.ts`.
2. After every screen is complete, delete `disabled` from `frontend-screens` in `packages/frontend/lint.config.ts`.
3. After every journey is complete, delete `disabled` from `frontend-journeys` in `packages/frontend/lint.config.ts`.

After each deletion, fix the complete diagnostic batch, complete the truthful evidence mappings, and wait for a reload without diagnostics before continuing to the next stage.

Keep `pnpm dev` running through Overall Final.

## Runtime Check

Remove every source-owned `@todo` under `packages/frontend`; this sweep must return nothing:

```bash
rg --hidden -n -F '@todo' packages/frontend --glob '*.ts' --glob '*.tsx'
```

Ensure `pnpm dev` is running from `packages/backend`, and keep both processes running through Overall Final.

Run `pnpm test:e2e`, which builds live against the live backend and fix every failure. After the last fix, require a frontend reload without diagnostics and an E2E exit code of 0.
