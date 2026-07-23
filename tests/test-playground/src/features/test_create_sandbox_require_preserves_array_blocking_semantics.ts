import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies exports arrays preserve Node's final null/invalid decision.
 *
 * 1. Put empty, null-only, invalid-then-null, and null-then-valid arrays under the
 *    active `require` condition with an outer default.
 * 2. Assert blocked arrays cannot reach the default while the later valid target
 *    remains selectable.
 */
export const test_create_sandbox_require_preserves_array_blocking_semantics =
  () => {
    const require = createSandboxRequire(
      {
        "empty/package.json": JSON.stringify({
          exports: { require: [], default: "./default.cjs" },
        }),
        "empty/default.cjs": "module.exports = 'wrong';",
        "null/package.json": JSON.stringify({
          exports: { require: [null], default: "./default.cjs" },
        }),
        "null/default.cjs": "module.exports = 'wrong';",
        "invalid-null/package.json": JSON.stringify({
          exports: {
            require: ["invalid", null],
            default: "./default.cjs",
          },
        }),
        "invalid-null/default.cjs": "module.exports = 'wrong';",
        "null-valid/package.json": JSON.stringify({
          exports: {
            require: [null, "./valid.cjs"],
            default: "./default.cjs",
          },
        }),
        "null-valid/valid.cjs": "module.exports = 'valid';",
        "dot-condition/package.json": JSON.stringify({
          exports: {
            require: { ".": "./wrong.cjs" },
            default: "./default.cjs",
          },
        }),
        "dot-condition/default.cjs": "module.exports = 'default';",
      },
      { console },
    );

    for (const name of ["empty", "null", "invalid-null"]) {
      assert.throws(() => require(name), /is not available/);
    }
    assert.equal(require("null-valid"), "valid");
    assert.equal(
      require("dot-condition"),
      "default",
      "an inactive nested dot key leaves the branch unresolved",
    );
  };
