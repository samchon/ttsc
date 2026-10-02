import assert from "node:assert/strict";

import { packageNameFromSpecifier } from "../../../../packages/playground/lib/src/index.js";

/**
 * Verifies the built playground entry exposes its dependency-name contract.
 *
 * Source units cover registry, sandbox and worker semantics; this boundary
 * retains the compiled public entry and its runtime dependencies.
 *
 * 1. Resolve a scoped subpath through the compiled entry.
 * 2. Reject a Node builtin through that same entry.
 *
 * @evidence contracts/testing.md#behavioral-verification packageNameFromSpecifier accepts a scoped package subpath and rejects a Node builtin through the compiled playground public entry.
 * @evidence contracts/testing.md#independent-expectations The npm scoped-package grammar identifies @scope/package and the Node builtin contract excludes node:fs; both expectations are literal and independent.
 * @evidence contracts/testing.md#distinguishing-cases A scoped subpath and a builtin negative twin distinguish the public built export from an always-null or passthrough implementation; source units own the full resolver matrix.
 * @evidence contracts/testing.md#execution-ownership This sole experiment entry of the playground package runs the compiled playground entry and source units own portable resolver semantics.
 * @evidence contracts/e2e.md#necessary-boundary The emitted public entry and runtime dependencies must resolve and execute together; source-only resolver tests cannot detect missing compiled exports or dependency loading failures.
 * @evidence contracts/e2e.md#shared-execution One workspace build supplies the artifact and one imported module answers both cases; no per-input installation, project load, native build or process lifetime is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity These calls are pure and borrow one immutable imported artifact; they allocate no cache, fixture filesystem or child process whose state could determine another case.
 * @evidence contracts/e2e.md#preserved-coverage The original scoped-subpath positive and builtin negative assertions remain unchanged; registry, sandbox and worker semantics retain their source-unit owners.
 */
export function test_e2e_playground(): void {
  assert.equal(
    packageNameFromSpecifier("@scope/package/subpath"),
    "@scope/package",
  );
  assert.equal(packageNameFromSpecifier("node:fs"), null);
}
