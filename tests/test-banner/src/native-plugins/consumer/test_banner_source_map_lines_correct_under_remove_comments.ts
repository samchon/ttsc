import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../internal/TestBanner";
import { decodeSourceLines } from "../../internal/decode-source-map";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: source maps stay correct under
 * `removeComments`, where the banner text is stripped from the output but the
 * source is still preamble-shifted.
 *
 * The banner is injected at the source level regardless of `removeComments`, so
 * even when tsgo strips the banner comment from the emitted `.js` / `.d.ts`,
 * the recorded source coordinates are still shifted and the maps must be
 * corrected. The host runs the map correction unconditionally for exactly this
 * reason; a refactor that only corrected maps when injecting banner text would
 * silently break this case, which no other test covers (the comment-stripping
 * test has no source map; the source-map tests keep comments).
 *
 * 1. Build a multi-line project with `removeComments`, `sourceMap`, `declaration`,
 *    and `declarationMap`, plus a banner.
 * 2. Run `ttsc --emit`.
 * 3. Assert the banner text is absent from `.js`, yet `.js.map` and `.d.ts.map`
 *    map every statement inside the real source (first at line 0).
 *
 * @evidence contracts/testing.md#behavioral-verification With removeComments the JS banner must disappear while JS/declaration mappings remain nonempty, start at 0 and stay below authored EOF.
 * @evidence contracts/testing.md#independent-expectations Authored zero-based line positions and explicit removeComments independently define removed text and map bounds.
 * @evidence contracts/testing.md#distinguishing-cases This combines absent emitted comment with a still-preamble-shifted parser input; retained-comment maps are the adjacent control.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_source_map_lines_correct_under_remove_comments entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native compiler comment removal and post-emit map correction must connect even when the emitted banner no longer exists.
 * @evidence contracts/e2e.md#shared-execution removeComments changes the emit state and requires an independent compile from retained-comment map consumers. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage With removeComments the JS banner must disappear while JS/declaration mappings remain nonempty, start at 0 and stay below authored EOF. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_source_map_lines_correct_under_remove_comments() {
    const source = [
      "export const alpha: number = 1;",
      "export const beta: number = 2;",
      "export function gamma(x: number): number {",
      "  return x + alpha + beta;",
      "}",
      "",
    ].join("\n");
    const sourceLineCount = source.split("\n").length;

    const root = TestProject.commonJsProject(
      {
        "banner.config.cjs": `module.exports = { text: "Copyright\\nMIT License\\nthird line\\nfourth line" };\n`,
        "src/main.ts": source,
      },
      {
        compilerOptions: {
          removeComments: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          plugins: [
            { transform: "@ttsc/banner", configFile: "banner.config.cjs" },
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
    assert.doesNotMatch(
      js,
      /@packageDocumentation|Copyright/,
      "removeComments must strip the banner from the .js",
    );

    for (const mapName of ["main.js.map", "main.d.ts.map"]) {
      const map = JSON.parse(
        fs.readFileSync(path.join(root, "dist", mapName), "utf8"),
      );
      const sourceLines = decodeSourceLines(map.mappings);
      assert.ok(sourceLines.length > 0, `${mapName} must contain mappings`);
      const maxLine = Math.max(...sourceLines);
      assert.ok(
        maxLine < sourceLineCount,
        `${mapName} maps to source line ${maxLine}, beyond the ${sourceLineCount}-line source (preamble shift not corrected under removeComments)`,
      );
      assert.equal(
        Math.min(...sourceLines),
        0,
        `${mapName} must map its first statement to source line 0`,
      );
    }
}
