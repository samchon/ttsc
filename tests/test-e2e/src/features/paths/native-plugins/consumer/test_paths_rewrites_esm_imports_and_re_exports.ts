import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../../../../internal/paths/internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/paths/internal/plugin-cache";

/**
 * Verifies the @ttsc/paths plugin: paths rewrites ESM imports and re-exports.
 *
 * The paths plugin must rewrite every reference to a `compilerOptions.paths`
 * alias — static imports, named re-exports, type-only re-exports, inline
 * `import()` types, dynamic `import()` expressions, and CommonJS-style
 * `require()` calls — in both `.js` and `.d.ts` outputs. A single missed form
 * would leave broken specifiers that bundlers or runtimes cannot resolve. It
 * also covers the multi-candidate alias (`@lib/*` maps to two directories)
 * where the first candidate is a missing path and the second resolves.
 *
 * 1. Create an ES2022 module project with `paths` aliases covering an exact match,
 *    a wildcard with a missing first candidate, and a bare specifier, and
 *    source files using all six import/export forms.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert all alias specifiers are replaced with relative paths in `.js` and
 *    `.d.ts`, including the `declare module` augmentation block.
 *
 * @evidence contracts/testing.md#behavioral-verification JS/declarations must replace exact, fallback wildcard and package aliases across static exports, require, dynamic import, type imports and module augmentation.
 * @evidence contracts/testing.md#independent-expectations Authored rootDir/outDir paths define ./modules/exact.js, ./modules/message.js and ./pkg/index.js independently.
 * @evidence contracts/testing.md#distinguishing-cases Missing first wildcard candidate precedes the successful target; all aliases must disappear from the relevant published JS/declaration forms.
 * @evidence contracts/testing.md#execution-ownership This named test_paths_rewrites_esm_imports_and_re_exports entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native AST mutation must reach actual JS and declaration serializers, not only in-process AST inspection.
 * @evidence contracts/e2e.md#shared-execution One ES2022 project jointly compiles every syntax form and alias shape; typed NodeNext, copied JSON and allowJs require different compiler-option contexts. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage JS/declarations must replace exact, fallback wildcard and package aliases across static exports, require, dynamic import, type imports and module augmentation. All original assertions remain in this named entry. TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals owns eligible syntax, adjacent ordinary literals and lexical require controls in the Go unit population; these emit assertions retain serializer and copied-output responsibility.
 */
export function test_paths_rewrites_esm_imports_and_re_exports() {
  const root = TestProject.createProject(FixtureFiles.read("paths/paths_rewrites_esm_imports_and_re_exports/inputs-1"));
  TestPaths.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /from "\.\/modules\/exact\.js"/);
  assert.match(js, /from "\.\/modules\/message\.js"/);
  assert.match(js, /from "\.\/pkg\/index\.js"/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.match(js, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /@lib\/message/);
  assert.doesNotMatch(js, /@lib\/exact/);
  assert.doesNotMatch(js, /@pkg/);
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(dts, /from "\.\/modules\/message\.js"/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.match(dts, /declare module "\.\/modules\/message\.js"/);
  assert.doesNotMatch(dts, /@lib\/message/);
}
