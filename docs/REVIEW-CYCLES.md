# Review Cycles

This file records the initial standalone migration review from `../typia@next/toolchain`.

## Cycle 1. Package Boundary

- Moved `ttsc` and `ttsx` into `packages/*`.
- Renamed package contracts from `@typia/ttsc` / `@typia/ttsx` to `ttsc` / `ttsx`.
- Updated Go module path to `github.com/samchon/ttsc/packages/ttsc`.

## Cycle 2. Consumer Coupling

- Removed runtime imports of `@typia/ttsc`.
- Removed `ttsx` cache salt probes for consumer package native folders.
- Replaced project tests that used `typia/lib/transform` as a dummy plugin path with generic local plugin paths.

## Cycle 3. TypeScript-Go Wrapper

- Verified `packages/ttsc/go.mod` pins `github.com/microsoft/typescript-go v0.0.0-20260408193441-2a5e1cf9fe22`.
- Verified shim modules are wired through local `replace` entries.
- Verified `go test ./...` passes under `packages/ttsc`.

## Cycle 4. CLI And JS API

- Built `ttsc` through its Go-hosted build lane.
- Built `ttsc-native`.
- Built `ttsx` through the workspace-linked `ttsc`.

## Cycle 5. Generic Plugin Host

- Added a standalone smoke fixture with a generic `transformOutput` plugin.
- Verified `ttsc transform` composes plugin post-processing with native emit.

## Cycle 6. Diagnostics

- Added a standalone semantic-error fixture.
- Verified `ttsc --emit` blocks before writing JavaScript when TypeScript-Go reports a semantic diagnostic.

## Cycle 7. Runner

- Added a standalone `ttsx` CommonJS runner fixture.
- Verified `ttsx` executes a TypeScript entry through the shared `ttsc` host.

## Cycle 8. Maintenance Contract

- Added `AGENTS.md` with TypeScript-Go drift policy, required commands, review surfaces, and local reference repositories.
- Added root workspace README.
