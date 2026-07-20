import assert from "node:assert/strict";
import { builtinModules } from "node:module";

import { packageNameFromSpecifier } from "../../../../packages/playground/lib/src/npm/packageNameFromSpecifier.js";

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
  assert.equal(packageNameFromSpecifier("ordinary/deep"), "ordinary");
  assert.equal(packageNameFromSpecifier("https://example.com/pkg"), null);
  assert.equal(packageNameFromSpecifier("node:not-a-real-builtin"), null);
};
