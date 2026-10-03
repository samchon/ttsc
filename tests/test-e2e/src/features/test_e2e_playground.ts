import assert from "node:assert/strict";

import { packageNameFromSpecifier } from "../../../../packages/playground/lib/src/index.js";

/**
 * Verifies the built playground entry exposes its dependency-name contract.
 *
 * These two pure classifier calls have no playground host or protocol input.
 * Their exact literals also live in the authored source-unit owner.
 *
 * 1. Resolve a scoped subpath through the compiled entry.
 * 2. Reject a Node builtin through that same entry.
 *
 * @evidence contracts/testing.md#behavioral-verification packageNameFromSpecifier accepts a scoped package subpath and rejects a Node builtin through the compiled playground public entry.
 * @evidence contracts/testing.md#independent-expectations The npm scoped-package grammar identifies @scope/package and the Node builtin contract excludes node:fs; both expectations are literal and independent.
 * @evidence contracts/testing.md#distinguishing-cases The scoped positive and builtin negative reject always-null and passthrough behavior. They do not exercise registry, sandbox, worker or host resolution.
 * @evidence contracts/testing.md#execution-ownership This named entry directly invokes the built classifier in the runner process. tests/test-playground/src/features/test_package_name_from_specifier_matches_node_builtins.ts directly invokes the authored classifier with these exact two literals; its added-input execution is not certified here.
 * @evidence contracts/e2e.md#necessary-boundary No installed consumer, product host or protocol-specific failure is supplied by these pure calls. Their portable meaning belongs to the direct source unit; importing a built module alone does not establish a necessary playground boundary or authorize a new host scenario.
 * @evidence contracts/e2e.md#shared-execution One workspace build supplies the artifact and one imported module answers both cases; no per-input installation, project load, native build or process lifetime is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity These calls are pure and borrow one immutable imported artifact; they allocate no cache, fixture filesystem or child process whose state could determine another case.
 * @evidence contracts/e2e.md#preserved-coverage Both exact original calls remain here and are authored in the named direct unit. That body's presence is not after-runtime survival; this duplicate remains pending actual selected survivor execution before removal. Unrelated registry/sandbox/worker coverage is not inferred.
 */
export function test_e2e_playground(): void {
  assert.equal(
    packageNameFromSpecifier("@scope/package/subpath"),
    "@scope/package",
  );
  assert.equal(packageNameFromSpecifier("node:fs"), null);
}
