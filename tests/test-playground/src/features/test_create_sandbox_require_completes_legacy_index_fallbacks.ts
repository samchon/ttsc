import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies packages without exports retain Node-style legacy fallbacks.
 *
 * 1. Provide a missing main with a root index, a JSON-only root index, and a main
 *    directory containing only `index.json`.
 * 2. Assert failed main lookup continues to root fallback and JSON index files are
 *    available at both directory levels.
 */
export const test_create_sandbox_require_completes_legacy_index_fallbacks =
  () => {
    const require = createSandboxRequire(
      {
        "missing-main/package.json": JSON.stringify({
          main: "./missing.cjs",
        }),
        "missing-main/index.js": "module.exports = 'root-index';",
        "json-root/package.json": JSON.stringify({}),
        "json-root/index.json": JSON.stringify({ value: "json-root" }),
        "json-directory/package.json": JSON.stringify({ main: "./lib" }),
        "json-directory/lib/index.json": JSON.stringify({
          value: "json-directory",
        }),
      },
      { console },
    );

    assert.equal(require("missing-main"), "root-index");
    assert.deepEqual(require("json-root"), { value: "json-root" });
    assert.deepEqual(require("json-directory"), {
      value: "json-directory",
    });
  };
