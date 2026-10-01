import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies exports targets use URL pathname semantics before pack lookup.
 *
 * Raw target strings are URLs, not in-memory map keys. Looking them up without
 * normalization rejects valid packages or treats query and fragment text as a
 * filename.
 *
 * 1. Declare encoded characters, double encoding, query/hash suffixes,
 *    backslashes, and repeated slashes that Node resolves inside the package.
 * 2. Assert each resolves to the normalized pack key without weakening the
 *    existing encoded-separator escape rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual sandbox loader for seven exported subpaths: percent-decoded, double-encoded, query/hash, backslash and repeated-slash targets return literal module exports, while an encoded separator is rejected.
 * @evidence contracts/testing.md#independent-expectations URL pathname rules decode percent escapes once and exclude query/fragment from file identity. Distinct authored pack keys and values independently distinguish foo, literal percent-encoded parent text, suffix and normalized directory selection.
 * @evidence contracts/testing.md#distinguishing-cases Single versus double encoding, query versus fragment, backslash versus repeated slash and encoded slash rejection preserve separate assertions; successful normalization cannot weaken package-boundary validation.
 * @evidence contracts/testing.md#execution-ownership This named source unit directly executes createSandboxRequire with an immutable in-memory pack and evaluates its literal CommonJS modules. URL objects are local parsing operations, not network requests; no native artifact, installation or product process is used.
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
  assert.throws(() => require("urls/escape"), /invalid module specifier/);
};
