import assert from "node:assert/strict";

import { restoreStrippedNodeBuiltinScheme } from "../../../../../packages/ttsc/lib/launcher/internal/runtimeHooks.js";

/**
 * Verifies builtin URL normalization owns only Node's exact resolver defect.
 *
 * The compatibility helper must copy a result only for a real core builtin
 * whose URL is its exact prefix-stripped spelling. All already-correct,
 * remapped, near-boundary, and non-builtin results retain both their values and
 * object identities.
 *
 * 1. Normalize every known prefix-only builtin with extra resolve metadata.
 * 2. Exercise ordinary, ESM-shaped, custom, near-boundary, and non-core cases.
 * 3. Assert exact copies preserve metadata and every passthrough stays identical.
 */
export const test_restore_stripped_node_builtin_scheme_normalizes_only_exact_core_builtins =
  () => {
    for (const specifier of [
      "node:sqlite",
      "node:test",
      "node:test/reporters",
      "node:sea",
    ]) {
      const result = {
        format: "builtin",
        shortCircuit: false,
        url: specifier.slice("node:".length),
      };
      const normalized = restoreStrippedNodeBuiltinScheme(specifier, result);
      assert.notStrictEqual(normalized, result);
      assert.deepEqual(normalized, {
        format: "builtin",
        shortCircuit: false,
        url: specifier,
      });
    }

    for (const [specifier, result] of [
      ["node:crypto", { format: "builtin", url: "node:crypto" }],
      ["node:sqlite", { format: "builtin", url: "node:sqlite" }],
      ["node:sqlite", { shortCircuit: true, url: "ttsx-custom:sqlite" }],
      ["node:sqlite", { shortCircuit: true, url: "sqlite?custom" }],
      ["node:custom", { format: "commonjs", url: "custom" }],
      ["virtual:sqlite", { format: "commonjs", url: "sqlite" }],
    ] as const) {
      assert.strictEqual(
        restoreStrippedNodeBuiltinScheme(specifier, result),
        result,
      );
    }
  };
