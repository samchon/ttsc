import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/paths plugin: aliases in bundler-resolved ES modules are
 * rewritten to emitted specifiers, including JavaScript sources.
 *
 * One project mixes both former inputs. TypeScript aliases appear as imports,
 * re-exports, `import()` types, `require` and dynamic `import()`, resolved by an
 * exact entry, a wildcard with a missing first candidate and a directory entry.
 * Extensionless aliases target `.js`, `.mjs`, `.cjs` and `.jsx` sources under
 * `allowJs`, whose emitted extensions differ and must be reproduced.
 *
 * 1. Emit the project through the launcher.
 * 2. Assert every alias form in `main.js` and `main.d.ts` became the emitted
 *    relative specifier and no alias text remains.
 * 3. Assert the copied JavaScript outputs exist and their consumers name each
 *    emitted extension.
 *
 * @evidence contracts/testing.md#behavioral-verification A real ttsc emit must rewrite import, re-export, require, dynamic import and import-type aliases in JavaScript and declarations, and name the .js, .mjs, .cjs and .jsx outputs for extensionless JavaScript targets.
 * @evidence contracts/testing.md#independent-expectations The authored tsconfig paths and source tree determine the emitted relative specifiers and extensions; the assertions state them literally rather than recomputing them from the plugin.
 * @evidence contracts/testing.md#distinguishing-cases Exact, wildcard-with-missing-candidate and directory mappings are separate positive forms; four JavaScript extensions each need a distinct emitted spelling; alias text remaining in output is the negative check. Nodenext and JSON aliases belong to sibling scenarios.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_paths with the shared workspace; rewriting is observed in real launcher output, while pure path matching and output prediction belong to Go units.
 * @evidence contracts/e2e.md#necessary-boundary The tsconfig plugin entry, real module resolution and emitted copy of JavaScript files meet in the native host; only an emit shows that the rewritten specifier names a file that exists.
 * @evidence contracts/e2e.md#shared-execution The two former bundler projects share one project, one compiler load and one emit; their paths tables are unioned with the specific entries preceding the wildcard, so distinct inputs coexist without a second invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario writes only its own dist directory; its file names differ per input so outputs cannot overwrite each other, and nodenext or CommonJS settings live in other scenario directories.
 * @evidence contracts/e2e.md#preserved-coverage Retains all former import, re-export, require, dynamic import, import-type, declaration and four-extension assertions at the same strictness; the union adds that the two input families coexist under one paths table.
 */
export function case_paths_rewrites_bundler_esm_and_allow_js_targets(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "es-bundler";
  const result = UtilityWorkspace.emit(workspace, scenario);
  assert.equal(result.status, 0, result.stderr);

  const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
  assert.match(js, /from "\.\/modules\/exact\.js"/);
  assert.match(js, /from "\.\/modules\/message\.js"/);
  assert.match(js, /from "\.\/pkg\/index\.js"/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.match(js, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /@lib\/message/);
  assert.doesNotMatch(js, /@lib\/exact/);
  assert.doesNotMatch(js, /@pkg/);
  const dts = UtilityWorkspace.read(workspace, scenario, "dist/main.d.ts");
  assert.match(dts, /from "\.\/modules\/message\.js"/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.match(dts, /declare module "\.\/modules\/message\.js"/);
  assert.doesNotMatch(dts, /@lib\/message/);

  for (const file of [
    "dist/modules/plain.js",
    "dist/modules/native.mjs",
    "dist/modules/legacy.cjs",
    "dist/modules/view.jsx",
  ])
    assert.equal(UtilityWorkspace.exists(workspace, scenario, file), true, file);
  const mjs = UtilityWorkspace.read(workspace, scenario, "dist/js-targets.mjs");
  assert.match(mjs, /from "\.\/modules\/plain\.js"/);
  assert.match(mjs, /from "\.\/modules\/native\.mjs"/);
  assert.match(mjs, /from "\.\/modules\/view\.jsx"/);
  assert.doesNotMatch(mjs, /@lib\//);
  const cjs = UtilityWorkspace.read(workspace, scenario, "dist/js-require-consumer.cjs");
  assert.match(cjs, /require\("\.\/modules\/legacy\.cjs"\)/);
  assert.doesNotMatch(cjs, /@lib\/legacy/);
}
