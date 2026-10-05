import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies the sandbox follows Node's target-selection boundaries for exports.
 *
 * Selection and file loading are separate in Node. Arrays may skip invalid,
 * null, and unresolved members, but a valid selected target does not fall
 * through merely because its file is missing. Conditional objects continue
 * after an active nested branch resolves to no target.
 *
 * 1. Exercise missing, invalid, nested-condition, mixed-map, and numeric cases.
 * 2. Require each package through the same public sandbox entry point.
 * 3. Assert selection fallback occurs only where Node permits it.
 *
 * @evidence contracts/testing.md#behavioral-verification createSandboxRequire distinguishes target selection from file loading: selected missing target rejects, invalid array member falls back, inactive nested condition yields outer default and bare/mixed/numeric declarations reject.
 * @evidence contracts/testing.md#independent-expectations Node CommonJS package-target semantics determine valid-selection versus invalid-selection fallback; independent populated fallback/main modules carry distinct literal values so accidental private loading fails.
 * @evidence contracts/testing.md#distinguishing-cases Six packages separate selected-but-missing, invalid-then-valid, inactive nested condition, invalid bare target, mixed condition/subpath map and numeric condition key.
 * @evidence contracts/testing.md#execution-ownership This discoverable entry calls the authored sandbox resolver/evaluator on six in-memory fixture manifests; its CommonJS module strings run directly without a browser, installation or external process.
 */
export const test_create_sandbox_require_matches_node_export_target_decisions =
  () => {
    const require = createSandboxRequire(
      {
        "missing/package.json": JSON.stringify({
          exports: ["./missing.cjs", "./fallback.cjs"],
        }),
        "missing/fallback.cjs": "module.exports = 'wrong fallback';",
        "invalid/package.json": JSON.stringify({
          exports: ["bare-target", "./fallback.cjs"],
        }),
        "invalid/fallback.cjs": "module.exports = 'valid fallback';",
        "nested/package.json": JSON.stringify({
          exports: {
            require: { browser: "./browser.cjs" },
            default: "./default.cjs",
          },
        }),
        "nested/default.cjs": "module.exports = 'outer default';",
        "bare/package.json": JSON.stringify({
          exports: "bare-target",
          main: "./main.cjs",
        }),
        "bare/main.cjs": "module.exports = 'private main';",
        "mixed/package.json": JSON.stringify({
          exports: { ".": "./index.cjs", require: "./index.cjs" },
        }),
        "mixed/index.cjs": "module.exports = true;",
        "numeric/package.json": JSON.stringify({
          exports: { 0: "./zero.cjs", default: "./default.cjs" },
        }),
        "numeric/default.cjs": "module.exports = true;",
      },
      { console },
    );

    assert.throws(
      () => require("missing"),
      /require\("missing"\) is not available/,
      "a selected valid target must not fall through after file lookup fails",
    );
    assert.equal(require("invalid"), "valid fallback");
    assert.equal(require("nested"), "outer default");
    assert.throws(() => require("bare"), /invalid package target/);
    assert.throws(() => require("mixed"), /cannot mix subpath and condition/);
    assert.throws(() => require("numeric"), /numeric exports condition/);
  };
