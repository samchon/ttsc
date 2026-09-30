import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";

/**
 * Scan a wide executable template substitution without depending on the VM's
 * variadic argument limit, while retaining an import that follows it.
 *
 * @evidence contracts/testing.md#behavioral-verification collectExternalPackageNames scans the authored wide template and returns only actual-package; no RangeError or raw-template false positive is permitted.
 * @evidence contracts/testing.md#independent-expectations The literal require following the substitution independently defines the one external dependency; numeric array entries and raw template text contain no executable imports.
 * @evidence contracts/testing.md#distinguishing-cases A 200000-entry substitution crosses practical variadic-call limits; empty and singleton substitutions retain the same following dependency, and a raw require lookalike stays inert.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry directly calls the authored lexical collector in the shared playground process; it creates only in-memory source strings and starts no compiler, install or host.
 */
export const test_collect_external_package_names_accepts_wide_template_substitutions = (): void => {
  for (const size of [0, 1, 200_000]) {
    const source = 'const x = `require("raw-ghost") ${[' +
      Array(size).fill("0").join(",") +
      ']}`; require("actual-package");';
    assert.deepEqual(collectExternalPackageNames(source, []), ["actual-package"]);
  }
};
