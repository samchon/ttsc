import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies aliased package self-reference uses manifest identity.
 *
 * Npm aliases mount a package under the requested alias while preserving its
 * real `package.json#name`. Node allows modules inside a package that declares
 * exports to require that real name through the package's own exports map.
 *
 * 1. Mount an exported package under an alias and require its real-name subpath.
 * 2. Mount a legacy alias without exports as the adjacent negative case.
 * 3. Assert only the exports-owning package gains self-reference behavior.
 * @evidence contracts/testing.md#behavioral-verification createSandboxRequire resolves actual/sub from the alias-mounted exported package to {value:42}, but rejects legacy-actual/sub from a package without exports.
 * @evidence contracts/testing.md#independent-expectations The authored manifests distinguish mount alias from actual package name; Node self-reference requires declared exports, and distinct populated submodule bytes establish the independently expected positive and negative results.
 * @evidence contracts/testing.md#distinguishing-cases An exported alias uses its real-name subpath while a legacy alias with a present private sub.js cannot gain self-reference; exact returned object and requested-name error are retained.
 * @evidence contracts/testing.md#execution-ownership This named entry evaluates both authored alias fixture modules through createSandboxRequire in the portable source-unit batch without npm installation or a consumer process.
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
