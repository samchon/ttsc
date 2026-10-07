import assert from "node:assert/strict";
import { builtinModules } from "node:module";

import { packageNameFromSpecifier } from "../../../../packages/playground/src/npm/packageNameFromSpecifier";

/**
 * Verifies playground package names: matches the pinned Node builtin surface.
 *
 * The browser cannot read Node's builtin list at runtime, so this Node-side
 * feature test is the drift guard for the checked-in classifier. A bare builtin
 * must never become an npm registry request merely because a package with the
 * same name exists on the public registry.
 *
 * 1. Compare every ordinary builtin root and subpath against Node's runtime list
 *    in both bare and `node:` spellings.
 * 2. Keep prefix-only builtins, URL specifiers, scoped packages, and ordinary npm
 *    names on their distinct classification paths.
 * 3. Preserve the exact scoped-subpath and builtin inputs of the playground
 *    boundary case as direct source calls.
 *
 * @evidence contracts/testing.md#behavioral-verification packageNameFromSpecifier excludes runtime Node builtin roots, their subpaths and node: forms while preserving scoped/ordinary npm package roots and rejecting URL or unknown node: requests. Exact @scope/package/subpath and node:fs calls preserve the boundary case's positive and negative classifier assertions.
 * @evidence contracts/testing.md#independent-expectations Node builtinModules is an independent runtime reference for the portable classifier; npm scope/name identity independently fixes the literal @scope/package expectation, and Node's fs builtin contract fixes null for node:fs. Neither expectation is derived from the classifier.
 * @evidence contracts/testing.md#distinguishing-cases Every ordinary builtin root has bare/node:/subpath controls, prefix-only runtime builtins distinguish their bare npm names, and scoped/deep/URL/unknown-prefixed cases remain explicit. The exact scoped subpath positive contrasts with the explicit node:fs negative without depending on runtime list generation for those two inputs.
 * @evidence contracts/testing.md#execution-ownership This named source unit owns the builtinModules-derived rows and literal boundary calls, including the exact two classifier inputs from test_e2e_playground. It calls the authored classifier and Node API in process; it does not exercise the built public export, registry, fixture install or child host.
 */
export const test_package_name_from_specifier_matches_node_builtins = () => {
  const roots = [
    ...new Set(
      builtinModules.filter(
        (moduleName) =>
          !moduleName.startsWith("_") &&
          !moduleName.startsWith("node:") &&
          !moduleName.includes("/"),
      ),
    ),
  ];
  for (const root of roots) {
    assert.equal(packageNameFromSpecifier(root), null, `bare ${root}`);
    assert.equal(
      packageNameFromSpecifier(`node:${root}`),
      null,
      `node:${root}`,
    );
    assert.equal(packageNameFromSpecifier(`${root}/promises`), null);
  }

  // Node exposes these only with the `node:` prefix. Their bare spellings stay
  // valid npm requests instead of expanding the checked-in bare builtin set.
  for (const prefixed of builtinModules.filter(
    (moduleName) => moduleName.startsWith("node:") && !moduleName.includes("/"),
  )) {
    const bare = prefixed.slice("node:".length);
    assert.equal(packageNameFromSpecifier(prefixed), null, prefixed);
    assert.equal(packageNameFromSpecifier(bare), bare, bare);
  }

  assert.equal(
    packageNameFromSpecifier("@scope/package/deep"),
    "@scope/package",
  );
  assert.equal(
    packageNameFromSpecifier("@scope/package/subpath"),
    "@scope/package",
  );
  assert.equal(packageNameFromSpecifier("node:fs"), null);
  assert.equal(packageNameFromSpecifier("ordinary/deep"), "ordinary");
  assert.equal(packageNameFromSpecifier("https://example.com/pkg"), null);
  assert.equal(packageNameFromSpecifier("node:not-a-real-builtin"), null);
};
