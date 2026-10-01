import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: banner injects JavaScript and declaration
 * JSDoc.
 *
 * The banner text must appear as a `@packageDocumentation` JSDoc block at the
 * top of both the `.js` and `.d.ts` outputs, but must NOT bleed into the
 * accompanying source-map files (otherwise source positions shift and debugging
 * becomes misleading). This test pins the happy-path of the core banner
 * transform including multi-line text, source maps, and declaration maps.
 *
 * 1. Build a project with `declaration`, `declarationMap`, and `sourceMap`
 *    enabled, and a `banner.config.cjs` file referenced via `configFile` in the
 *    tsconfig plugin entry.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert the banner JSDoc block appears exactly once in `.js` and `.d.ts`.
 * 4. Assert the `.js.map` and `.d.ts.map` files contain no banner text.
 *
 * @evidence contracts/testing.md#behavioral-verification Emit must contain one multiline banner in both JS and declaration output, preserve map trailers, and produce v3 maps without banner markers.
 * @evidence contracts/testing.md#independent-expectations Dedicated config text and the public packageDocumentation output shape establish literal text/count expectations.
 * @evidence contracts/testing.md#distinguishing-cases Both emit kinds are positive; JS/declaration maps must exclude banner text and retain independent trailers.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_injects_javascript_and_declaration_jsdoc entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Source preamble and both emit serializers must publish the banner and map sidecars through the native host.
 * @evidence contracts/e2e.md#shared-execution One compilation jointly covers JS, declarations and their maps; its banner-only text differs from the coordinate fixture. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Emit must contain one multiline banner in both JS and declaration output, preserve map trailers, and produce v3 maps without banner markers. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_injects_javascript_and_declaration_jsdoc() {
  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "banner-only\\nsecond line" };\n`,
      "src/main.ts": `export interface Box { value: string }\nexport const box: Box = { value: "banner" };\n`,
    },
    {
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        sourceMap: true,
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
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  const jsMap = fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8");
  const dtsMap = fs.readFileSync(
    path.join(root, "dist", "main.d.ts.map"),
    "utf8",
  );
  TestBanner.assertSingleBanner(js, "banner-only\nsecond line");
  TestBanner.assertSingleBanner(dts, "banner-only\nsecond line");
  assert.match(js, /\n\/\/# sourceMappingURL=main\.js\.map$/);
  assert.match(dts, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
  assert.doesNotMatch(jsMap, /@packageDocumentation|banner-only/);
  assert.doesNotMatch(dtsMap, /@packageDocumentation|banner-only/);
  assert.equal(JSON.parse(jsMap).version, 3);
  assert.equal(JSON.parse(dtsMap).version, 3);
}
