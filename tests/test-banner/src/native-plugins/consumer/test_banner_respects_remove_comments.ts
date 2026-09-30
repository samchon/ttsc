import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: banner follows removeComments.
 *
 * When `compilerOptions.removeComments` is `true`, TypeScript-Go strips all
 * JSDoc and block comments from the output. The banner is itself a JSDoc block,
 * so the banner plugin must respect this flag and suppress its own output
 * rather than re-inserting a comment that the compiler just removed. Without
 * this guard the banner would survive `removeComments`, defeating the user's
 * intent and polluting minified builds.
 *
 * 1. Create a project with `removeComments: true` and a `banner.config.cjs` file
 *    referenced via `configFile` in the tsconfig plugin entry.
 * 2. Run `ttsc --emit` (declarations enabled) against that project.
 * 3. Assert the emitted `.js` and `.d.ts` files contain neither the banner text
 *    nor a `@packageDocumentation` tag.
 *
 * @evidence contracts/testing.md#behavioral-verification removeComments emit must exclude removed banner and packageDocumentation from both JS and declaration output.
 * @evidence contracts/testing.md#independent-expectations The compiler option explicitly forbids comments, including the authored banner JSDoc.
 * @evidence contracts/testing.md#distinguishing-cases Both emit kinds must suppress the preamble; retained-comment and mapped removal fixtures own complementary cases.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_respects_remove_comments entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Compiler comment suppression must act on native banner injection in both published outputs.
 * @evidence contracts/e2e.md#shared-execution This removed-banner fixture supplies an explicit CJS config and checks two emit kinds together; the map-removal fixture owns a different multiline preamble. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage removeComments emit must exclude removed banner and packageDocumentation from both JS and declaration output. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_respects_remove_comments() {
  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "removed banner" };\n`,
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        removeComments: true,
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.cjs",
          },
        ],
      },
    },
  );
  TestBanner.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8"),
    /@packageDocumentation|removed banner/,
  );
}
