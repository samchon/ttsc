import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies alias self-reference cannot cross a nearer package scope.
 *
 * Node assigns a source file to its nearest package manifest. Continuing past
 * that scope can execute a different package version mounted farther out.
 *
 * 1. Nest a differently named package inside an aliased package that declares
 *    exports, and require the outer real name from the nested entry.
 * 2. Assert the nearest manifest blocks the outer self-reference; also verify
 *    `exports: null` retains legacy main without gaining self-reference.
 *
 * @evidence contracts/testing.md#behavioral-verification createSandboxRequire rejects an outer real-name self-reference from inside a nearer differently named package, while exports:null retains the neighboring legacy-main result.
 * @evidence contracts/testing.md#independent-expectations Node nearest-package scope ownership fixes the rejection even though the outer sub.cjs exists with literal42; the nullable manifest independently specifies a populated legacy main.
 * @evidence contracts/testing.md#distinguishing-cases The nested-scope negative and null-exports positive distinguish stopping at the first manifest from climbing into an outer alias or treating null as an active exports boundary.
 * @evidence contracts/testing.md#execution-ownership This unit directly evaluates the authored nested fixture through createSandboxRequire and owns both boundary assertions in the source batch; no filesystem traversal or package installation is started.
 */
export const test_create_sandbox_require_stops_self_reference_at_the_nearest_scope =
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
        "alias/index.cjs": "module.exports = require('./nested/entry.cjs');",
        "alias/sub.cjs": "module.exports = 42;",
        "alias/nested/package.json": JSON.stringify({ name: "nested" }),
        "alias/nested/entry.cjs": "module.exports = require('actual/sub');",
        "nullable/package.json": JSON.stringify({
          exports: null,
          main: "./main.cjs",
          name: "nullable-actual",
        }),
        "nullable/main.cjs": "module.exports = 'legacy-main';",
      },
      { console },
    );

    assert.throws(() => require("alias"), /actual\/sub.*not available/);
    assert.equal(require("nullable"), "legacy-main");
  };
