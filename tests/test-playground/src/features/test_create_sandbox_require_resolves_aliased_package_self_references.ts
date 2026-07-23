import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies package self-reference uses manifest identity rather than mount
 * name.
 *
 * Npm aliases mount a package under the requested alias while preserving its
 * real `package.json#name`. Node allows modules inside a package that declares
 * exports to require that real name through the package's own exports map.
 */
export const test_create_sandbox_require_resolves_aliased_package_self_references =
  () => {
    const require = createSandboxRequire(
      {
        "alias/package.json": JSON.stringify({
          name: "actual",
          exports: {
            ".": "./index.cjs",
            "./sub": "./sub.cjs",
          },
        }),
        "alias/index.cjs": "module.exports = { value: require('actual/sub') };",
        "alias/sub.cjs": "module.exports = 42;",
        "legacy-alias/package.json": JSON.stringify({
          name: "legacy-actual",
          main: "./index.cjs",
        }),
        "legacy-alias/index.cjs":
          "module.exports = require('legacy-actual/sub');",
        "legacy-alias/sub.js": "module.exports = 'private';",
      },
      { console },
    );

    assert.deepEqual(require("alias"), { value: 42 });
    assert.throws(
      () => require("legacy-alias"),
      /require\("legacy-actual\/sub"\) is not available/,
      "a package without exports must not gain self-reference semantics",
    );
  };
