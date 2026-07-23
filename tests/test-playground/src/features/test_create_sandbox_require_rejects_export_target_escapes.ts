import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies exports targets cannot escape or reinterpret their package mount.
 *
 * Validation runs after wildcard substitution and percent decoding. Request
 * keys remain lookup keys, however: an exact key containing `..` is not itself
 * a target escape when it maps to a safe file.
 */
export const test_create_sandbox_require_rejects_export_target_escapes = () => {
  const require = createSandboxRequire(
    {
      "safe-key/package.json": JSON.stringify({
        exports: { "./a/../b": "./safe.cjs" },
      }),
      "safe-key/safe.cjs": "module.exports = 42;",
      "dot/package.json": JSON.stringify({
        exports: "./dist/../secret.cjs",
      }),
      "encoded-dot/package.json": JSON.stringify({
        exports: "./dist/%2e%2e/secret.cjs",
      }),
      "modules/package.json": JSON.stringify({
        exports: "./dist/NoDe_MoDuLeS/secret.cjs",
      }),
      "encoded-modules/package.json": JSON.stringify({
        exports: "./dist/%6eode_modules/secret.cjs",
      }),
      "encoded-slash/package.json": JSON.stringify({
        exports: "./dist/%2Fsecret.cjs",
      }),
      "pattern/package.json": JSON.stringify({
        exports: { "./*": "./dist/*" },
      }),
    },
    { console },
  );

  assert.equal(require("safe-key/a/../b"), 42);
  for (const specifier of [
    "dot",
    "encoded-dot",
    "modules",
    "encoded-modules",
    "encoded-slash",
    "pattern/escape/../secret",
  ]) {
    assert.throws(
      () => require(specifier),
      /invalid package target/,
      specifier,
    );
  }
};
