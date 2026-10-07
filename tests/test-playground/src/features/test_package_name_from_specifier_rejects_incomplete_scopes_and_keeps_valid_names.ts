import assert from "node:assert/strict";

import { packageNameFromSpecifier } from "../../../../packages/playground/src/npm/packageNameFromSpecifier";

/**
 * Verifies incomplete scoped specifiers name no package while complete scoped
 * and bare specifiers reduce to their package identity.
 *
 * A scoped package needs both a scope and a name. `@scope`, `@scope/`, `@/x`
 * and `@scope//x` cannot be installed from the registry and must not trigger a
 * lookup, while subpaths of valid names reduce to the package root.
 *
 * 1. Offer the four incomplete scoped forms and expect null.
 * 2. Offer valid scoped and bare names with and without subpaths.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls packageNameFromSpecifier on incomplete and complete specifiers and compares each result with an authored literal.
 * @evidence contracts/testing.md#independent-expectations Expected names follow npm's scope/name package identity, written by hand per input rather than computed.
 * @evidence contracts/testing.md#distinguishing-cases Four incomplete scopes contrast with scoped, scoped-with-subpath, bare and bare-with-subpath names; fs-extra remains an npm name despite sharing the builtin fs prefix.
 * @evidence contracts/testing.md#execution-ownership Unit entry calling only the pure function in the test process; builtin and URL families are owned by test_package_name_from_specifier_matches_node_builtins, and relative paths by test_collect_external_package_names_ignores_non_code.
 */
export function test_package_name_from_specifier_rejects_incomplete_scopes_and_keeps_valid_names(): void {
  for (const incomplete of ["@scope", "@scope/", "@/x", "@scope//x"])
    assert.equal(packageNameFromSpecifier(incomplete), null, incomplete);

  const valid: [string, string][] = [
    ["@scope/pkg", "@scope/pkg"],
    ["@scope/pkg/deep/file.js", "@scope/pkg"],
    ["pkg", "pkg"],
    ["pkg/sub/path", "pkg"],
    ["fs-extra", "fs-extra"],
  ];
  for (const [specifier, expected] of valid)
    assert.equal(packageNameFromSpecifier(specifier), expected, specifier);
}
