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
 *
 * 1. Mount legacy, exact, pattern, array, condition, scoped, relative, and JSON
 *    package shapes.
 * 2. Require every available entry and the blocked negative twin.
 * 3. Assert each shared resolver branch retains its prior observable result.
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
      "s/sub.js": "module.exports = { v: 'private-direct-path' };",
      // wildcard subpath export
      "w/package.json": JSON.stringify({
        exports: {
          "./feat/*": "./src/feat/*.js",
          "./feat/deep/*": "./src/deep/*.js",
        },
      }),
      "w/src/feat/x.js": "module.exports = { v: 'wild' };",
      "w/src/deep/x.js": "module.exports = { v: 'deep-wild' };",
      // array fallback from an invalid target, null blocker, and inactive
      // condition target
      "a/package.json": JSON.stringify({
        exports: { "./entry": ["invalid-target", "./available.js"] },
      }),
      "a/available.js": "module.exports = { v: 'array' };",
      "blocked/package.json": JSON.stringify({ exports: { "./x": null } }),
      "blocked/x.js": "module.exports = { v: 'private' };",
      "conditions/package.json": JSON.stringify({
        exports: {
          "./entry": {
            node: "./node.js",
            import: "./import.mjs",
            default: "./default.js",
          },
        },
      }),
      "conditions/node.js": "module.exports = { v: 'node' };",
      "conditions/import.mjs": "export default { v: 'import' };",
      "conditions/default.js": "module.exports = { v: 'default' };",
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
  assert.deepEqual(
    require("w/feat/deep/x"),
    { v: "deep-wild" },
    "the longest wildcard prefix wins",
  );
  assert.deepEqual(require("a/entry"), { v: "array" }, "array fallback");
  assert.deepEqual(
    require("conditions/entry"),
    { v: "default" },
    "node/import conditions stay inactive in the browser sandbox",
  );
  assert.deepEqual(require("@sc/pkg"), { v: "scoped" }, "scoped package name");
  assert.deepEqual(require("r"), { v: 42 }, "relative sibling require");
  assert.deepEqual(require("j"), { v: "json" }, "JSON module");

  // An unknown bare specifier still fails and names itself.
  assert.throws(
    () => require("totally-absent"),
    /require\("totally-absent"\) is not available/,
  );
  assert.throws(
    () => require("blocked/x"),
    /require\("blocked\/x"\) is not available/,
    "a declared null export must block packed private files",
  );
};
