import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * The root-`exports` change (RA-12 / #670) must not regress the resolver's
 * other paths: `main` and `index` fallbacks, exact and wildcard subpath
 * exports, scoped package names, relative sibling requires, and JSON modules
 * all share `resolvePackageEntry` / `resolveSpecifier` and must keep working.
 *
 * This is the boundary guard for the root-exports fix: it exercises every
 * resolution branch other than the root-exports one in a single sandbox pack.
 */
export const test_create_sandbox_require_preserves_fallback_resolution = () => {
  const require = createSandboxRequire(
    {
      // main fallback (no exports field)
      "m/package.json": JSON.stringify({ main: "./lib/main.js" }),
      "m/lib/main.js": "module.exports = { v: 'main' };",
      // index fallback (no exports, no main)
      "i/package.json": JSON.stringify({}),
      "i/index.js": "module.exports = { v: 'index' };",
      // exact subpath export
      "s/package.json": JSON.stringify({
        exports: { "./sub": "./dist/sub.js" },
      }),
      "s/dist/sub.js": "module.exports = { v: 'sub' };",
      // wildcard subpath export
      "w/package.json": JSON.stringify({
        exports: { "./feat/*": "./src/feat/*.js" },
      }),
      "w/src/feat/x.js": "module.exports = { v: 'wild' };",
      // scoped package, main fallback
      "@sc/pkg/package.json": JSON.stringify({ main: "./main.js" }),
      "@sc/pkg/main.js": "module.exports = { v: 'scoped' };",
      // relative sibling require
      "r/package.json": JSON.stringify({ main: "./a.js" }),
      "r/a.js": "module.exports = { v: require('./b').n + 1 };",
      "r/b.js": "module.exports = { n: 41 };",
      // JSON module via main
      "j/package.json": JSON.stringify({ main: "./data.json" }),
      "j/data.json": JSON.stringify({ v: "json" }),
    },
    { console },
  );

  assert.deepEqual(require("m"), { v: "main" }, "main fallback");
  assert.deepEqual(require("i"), { v: "index" }, "index fallback");
  assert.deepEqual(require("s/sub"), { v: "sub" }, "exact subpath export");
  assert.deepEqual(
    require("w/feat/x"),
    { v: "wild" },
    "wildcard subpath export",
  );
  assert.deepEqual(require("@sc/pkg"), { v: "scoped" }, "scoped package name");
  assert.deepEqual(require("r"), { v: 42 }, "relative sibling require");
  assert.deepEqual(require("j"), { v: "json" }, "JSON module");

  // An unknown bare specifier still fails and names itself.
  assert.throws(
    () => require("totally-absent"),
    /require\("totally-absent"\) is not available/,
  );
};
