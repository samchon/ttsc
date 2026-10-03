import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies the sandbox require resolves legacy, exports, scoped, relative and JSON
 * packages from an in-memory pack.
 *
 * `main` and `index` fallbacks, exact and wildcard subpath exports, scoped
 * names, relative requires, and JSON modules all pass through the same package
 * entry and specifier resolution.
 *
 * 1. Mount legacy, exact, pattern, array, condition, scoped, relative, and JSON
 *    package shapes.
 * 2. Require each available entry and compare the returned module value.
 * 3. Require an absent package and a package whose exports declare null for the
 *    requested subpath, and assert both are reported as unavailable.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the returned createSandboxRequire loader for main and index fallbacks, an exact subpath export, two overlapping wildcard exports, an array with an invalid first target, node/import/default conditions, a scoped package, a relative sibling require and a JSON main; each result is compared with its literal value, and an absent package and a null-exported subpath must throw "is not available".
 * @evidence contracts/testing.md#independent-expectations Each fixture module exports a distinct literal (wild versus deep-wild, default versus node/import, a b.js exporting 41 so the caller must yield 42, a private file that must stay hidden), so the expected value follows from Node package-resolution rules rather than from resolver output.
 * @evidence contracts/testing.md#distinguishing-cases Legacy packages contrast with declared exports; the longer wildcard prefix must beat the shorter one, an invalid array member falls through to the valid one, node and import conditions stay inactive so default is chosen, and a null export must hide a file that exists in the pack. Deeper exports error cases are owned by the neighboring array, target-decision and URL-target tests.
 * @evidence contracts/testing.md#execution-ownership Unit-layer entry that calls createSandboxRequire over one local in-memory pack and evaluates its CommonJS strings in the test process; no installation, filesystem, native build or host starts.
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
