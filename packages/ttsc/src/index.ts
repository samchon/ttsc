/**
 * ttsc — public TypeScript entry.
 *
 * Exports:
 *   - tsgo helpers (`resolveTsgo`, …) — resolve the consuming project's
 *     `@typescript/native-preview` compiler binary.
 *   - platform helpers (`resolveBinary`, `installHint`, …) — compatibility
 *     helper resolution for commands such as `ttsc demo`.
 *   - programmatic API (`transform`, `build`, `check`, `version`) — a thin
 *     TS wrapper around the consumer `tsgo` binary plus JS output-plugin
 *     hooks. Adapters never have to shell out themselves; they call these
 *     helpers and get back a string or a result record.
 */

export * from "./platform";
export * from "./api";
export * from "./project";
export * from "./plugin";
export * from "./tsgo";
export * from "./runner/register";
