import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies packages without exports retain Node-style legacy fallbacks.
 *
 * Root, relative, and bare-subpath requests all enter CommonJS directory
 * resolution, but a selected root `main` must not recurse into another
 * manifest.
 *
 * 1. Exercise missing main, root JSON index, and main-directory JSON index.
 * 2. Resolve relative and bare subdirectories through their own manifests.
 * 3. Assert a root main target ignores a nested manifest and falls back to the
 *    root index.
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
        "nested/package.json": JSON.stringify({ main: "./entry.cjs" }),
        "nested/entry.cjs":
          "module.exports = [require('./jsondir'), require('./subdir')];",
        "nested/jsondir/index.json": JSON.stringify({ value: "relative-json" }),
        "nested/subdir/package.json": JSON.stringify({ main: "./main.cjs" }),
        "nested/subdir/main.cjs": "module.exports = 'relative-main';",
        "bare-sub/package.json": JSON.stringify({ main: "./index.cjs" }),
        "bare-sub/index.cjs": "module.exports = require('bare-sub/sub');",
        "bare-sub/sub/package.json": JSON.stringify({ main: "./main.cjs" }),
        "bare-sub/sub/main.cjs": "module.exports = 'bare-sub-main';",
        "main-boundary/package.json": JSON.stringify({ main: "./sub" }),
        "main-boundary/sub/package.json": JSON.stringify({
          main: "./nested.cjs",
        }),
        "main-boundary/sub/nested.cjs": "module.exports = 'wrong-nested-main';",
        "main-boundary/index.js": "module.exports = 'root-fallback';",
      },
      { console },
    );

    assert.equal(require("missing-main"), "root-index");
    assert.deepEqual(require("json-root"), { value: "json-root" });
    assert.deepEqual(require("json-directory"), {
      value: "json-directory",
    });
    assert.deepEqual(require("nested"), [
      { value: "relative-json" },
      "relative-main",
    ]);
    assert.equal(require("bare-sub"), "bare-sub-main");
    assert.equal(
      require("main-boundary"),
      "root-fallback",
      "a root main directory does not recursively interpret its manifest",
    );
  };
