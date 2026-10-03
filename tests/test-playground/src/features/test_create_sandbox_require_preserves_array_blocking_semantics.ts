import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies exports arrays preserve Node's final null/invalid decision.
 *
 * Flattening array candidates loses whether the last meaningful result blocked
 * a subpath or merely failed to resolve, which can expose an outer fallback
 * that the package explicitly denied.
 *
 * 1. Put empty, null-only, invalid-then-null, and null-then-valid arrays under the
 *    active `require` condition with an outer default.
 * 2. Exercise an inactive nested key and selected encoded, directory, and
 *    malformed targets that must fail during loading.
 * 3. Assert only invalid selection falls through; blocking and loading do not.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createSandboxRequire and requires each fixture package, asserting blocked exports never reveal default/fallback files while null-then-valid and inactive-condition controls return their literal module values.
 * @evidence contracts/testing.md#independent-expectations Node package-target resolution distinguishes blocked, unresolved and selected targets before loading. The independent empty/null arrays and malformed encoded targets define failures; valid.cjs and default.cjs contain distinct literal exports.
 * @evidence contracts/testing.md#distinguishing-cases Empty, null-only and invalid-then-null arrays block; null-then-valid succeeds. A nested inactive dot condition permits default, while encoded slash, directory and malformed-escape selected targets cannot switch to an existing array fallback.
 * @evidence contracts/testing.md#execution-ownership This exported unit executes the authored resolver/evaluator against immutable in-memory manifests and CommonJS strings in the playground batch. It opens no real package installation or host; the neighboring fallback and URL-target tests own legacy resolution and successful normalization.
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
        "load-error/package.json": JSON.stringify({
          exports: ["./%2foutside.cjs", "./fallback.cjs"],
        }),
        "load-error/fallback.cjs": "module.exports = 'wrong';",
        "directory/package.json": JSON.stringify({
          exports: ["./", "./fallback.cjs"],
        }),
        "directory/fallback.cjs": "module.exports = 'wrong';",
        "malformed/package.json": JSON.stringify({
          exports: ["./bad%escape.cjs", "./fallback.cjs"],
        }),
        "malformed/fallback.cjs": "module.exports = 'wrong';",
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
    assert.throws(() => require("load-error"), /invalid module specifier/);
    assert.throws(
      () => require("directory"),
      /is not available/,
      "a selected package-directory target must not reach array fallback",
    );
    assert.throws(() => require("malformed"), /invalid module specifier/);
  };
