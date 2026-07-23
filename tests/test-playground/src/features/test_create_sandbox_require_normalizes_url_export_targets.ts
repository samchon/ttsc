import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Verifies exports targets use URL pathname semantics before pack lookup.
 *
 * 1. Declare encoded characters, double encoding, query/hash suffixes,
 *    backslashes, and repeated slashes that Node resolves inside the package.
 * 2. Assert each resolves to the normalized pack key without weakening the
 *    existing encoded-separator escape rejection.
 */
export const test_create_sandbox_require_normalizes_url_export_targets = () => {
  const require = createSandboxRequire(
    {
      "urls/package.json": JSON.stringify({
        exports: {
          "./encoded": "./%66oo.cjs",
          "./double": "./%252e%252e/file.cjs",
          "./query": "./file.cjs?x",
          "./hash": "./file.cjs#x",
          "./backslash": "./dist\\file.cjs",
          "./slashes": "./dist//file.cjs",
          "./escape": "./%2foutside.cjs",
        },
      }),
      "urls/foo.cjs": "module.exports = 'encoded';",
      "urls/%2e%2e/file.cjs": "module.exports = 'double';",
      "urls/file.cjs": "module.exports = 'suffix';",
      "urls/dist/file.cjs": "module.exports = 'normalized';",
    },
    { console },
  );

  assert.equal(require("urls/encoded"), "encoded");
  assert.equal(require("urls/double"), "double");
  assert.equal(require("urls/query"), "suffix");
  assert.equal(require("urls/hash"), "suffix");
  assert.equal(require("urls/backslash"), "normalized");
  assert.equal(require("urls/slashes"), "normalized");
  assert.throws(() => require("urls/escape"), /invalid package target/);
};
