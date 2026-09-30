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
 */
export const test_built_package_entry_runs_its_public_functions = (): void => {
  assert.equal(
    packageNameFromSpecifier("@scope/package/subpath"),
    "@scope/package",
  );
  assert.equal(packageNameFromSpecifier("node:fs"), null);
};
