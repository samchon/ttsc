import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";

/**
 * Verifies package discovery scans a wide executable template substitution
 * without depending on the VM variadic argument limit.
 *
 * The scanner must neither spread an unbounded number of elements into one call
 * nor lose the import that follows the substitution. A require written inside
 * the template text is inert and must stay excluded.
 *
 * 1. Build a template whose executable substitution holds zero, one and 200000
 *    array elements, with an inert require in its text.
 * 2. Follow the template with a real require call.
 * 3. Require that only the real package is reported for every size.
 *
 * @evidence contracts/testing.md#behavioral-verification collectExternalPackageNames scans the authored wide template and returns only actual-package; no RangeError or raw-template false positive is permitted.
 * @evidence contracts/testing.md#independent-expectations The literal require following the substitution independently defines the one external dependency; numeric array entries and raw template text contain no executable imports.
 * @evidence contracts/testing.md#distinguishing-cases A 200000-entry substitution crosses practical variadic-call limits; empty and singleton substitutions retain the same following dependency, and a raw require lookalike stays inert.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry directly calls the authored lexical collector in the shared playground process; it creates only in-memory source strings and starts no compiler, install or host.
 */
export const test_collect_external_package_names_accepts_wide_template_substitutions =
  (): void => {
    for (const size of [0, 1, 200_000]) {
      const source =
        'const x = `require("raw-ghost") ${[' +
        Array(size).fill("0").join(",") +
        ']}`; require("actual-package");';
      assert.deepEqual(collectExternalPackageNames(source, []), [
        "actual-package",
      ]);
    }
  };
