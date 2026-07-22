import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies playground: sandbox require resolves general exports patterns.
 *
 * The sandbox recognized only trailing `/*`, so suffix-bearing Node patterns
 * appeared private after the compiler had accepted them. The resolver must rank
 * one-star keys by Node specificity and preserve null boundaries.
 *
 * 1. Define exact, overlapping, suffix, repeated-target, empty, and null cases.
 * 2. Require matching package subpaths through the sandbox.
 * 3. Assert the selected exports and rejected boundaries.
 */
export const test_create_sandbox_require_resolves_general_export_patterns =
  () => {
    const require = createSandboxRequire(
      {
        "patterns/package.json": JSON.stringify({
          exports: {
            "./features/exact.js": "./dist/exact.cjs",
            "./features/*": "./dist/plain/*.cjs",
            "./features/*.js": "./dist/suffixed/*.cjs",
            "./features/special-*.js": "./dist/special/*.cjs",
            "./twice/*.js": "./dist/twice/*/*.cjs",
            "./empty/*.js": "./dist/empty/*.cjs",
            "./private/*.js": null,
          },
        }),
        "patterns/dist/exact.cjs": "module.exports = { value: 'exact' };",
        "patterns/dist/plain/tool.js.cjs":
          "module.exports = { value: 'plain' };",
        "patterns/dist/plain/tool.css.cjs":
          "module.exports = { value: 'plain-css' };",
        "patterns/dist/suffixed/tool.cjs":
          "module.exports = { value: 'suffix' };",
        "patterns/dist/special/tool.cjs":
          "module.exports = { value: 'special' };",
        "patterns/dist/twice/tool/tool.cjs":
          "module.exports = { value: 'twice' };",
        "patterns/dist/empty/.cjs": "module.exports = { value: 'empty' };",
        "patterns/private/secret.js": "module.exports = { value: 'private' };",
      },
      { console },
    );

    assert.deepEqual(require("patterns/features/exact.js"), { value: "exact" });
    assert.deepEqual(require("patterns/features/tool.js"), { value: "suffix" });
    assert.deepEqual(require("patterns/features/special-tool.js"), {
      value: "special",
    });
    assert.deepEqual(require("patterns/features/tool.css"), {
      value: "plain-css",
    });
    assert.deepEqual(require("patterns/twice/tool.js"), { value: "twice" });
    assert.throws(
      () => require("patterns/empty/.js"),
      /require\("patterns\/empty\/\.js"\) is not available/,
    );
    assert.throws(
      () => require("patterns/private/secret.js"),
      /require\("patterns\/private\/secret\.js"\) is not available/,
    );
  };
