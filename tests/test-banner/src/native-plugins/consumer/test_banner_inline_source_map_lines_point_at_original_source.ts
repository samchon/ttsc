import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../../internal/TestBanner";
import { decodeSourceLines } from "../../internal/decode-source-map";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: an inline source map (embedded in the
 * `.js`) points at the real source lines, not the banner-shifted ones.
 *
 * With `inlineSourceMap` the map is base64-embedded in a `//#
 * sourceMappingURL=data:...` trailer instead of a separate `.js.map` file, so a
 * correction that only patched `.map` files would miss it and leave the banner
 * line shift in place. This decodes the embedded map and pins every referenced
 * source line back inside the real file — the inline counterpart of the
 * external-map banner test.
 *
 * 1. Build a multi-line project with `inlineSourceMap` and a multi-line banner.
 * 2. Run `ttsc --emit`.
 * 3. Decode the base64 map from the `.js` trailer; assert no mapping references a
 *    source line at/after EOF and the first statement maps to source line 0.
 *
 * @evidence contracts/testing.md#behavioral-verification The JS trailer must decode into a v3 map with nonempty lines starting at 0 and all below the authored source EOF.
 * @evidence contracts/testing.md#independent-expectations The source-map v3 trailer contract and literal authored source line count supply independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases A missing inline trailer, empty mappings and shifted source lines all fail; external sidecar correction has a separate owner.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_inline_source_map_lines_point_at_original_source entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary The native serializer publishes an embedded base64 trailer whose correction cannot be proved by checking external map files.
 * @evidence contracts/e2e.md#shared-execution inlineSourceMap changes the physical publication form and conflicts with sourceMap, requiring this independent compile. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage The JS trailer must decode into a v3 map with nonempty lines starting at 0 and all below the authored source EOF. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_inline_source_map_lines_point_at_original_source() {
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
          inlineSourceMap: true,
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
    const match = js.match(
      /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/,
    );
    const base64 = match?.[1];
    assert.ok(base64, "emitted JS must carry an inline base64 source map");
    const map = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    assert.equal(map.version, 3, "inline map must be a v3 source map");

    const sourceLines = decodeSourceLines(map.mappings);
    assert.ok(sourceLines.length > 0, "inline map must contain mappings");
    const maxLine = Math.max(...sourceLines);
    assert.ok(
      maxLine < sourceLineCount,
      `inline map maps to source line ${maxLine}, beyond the ${sourceLineCount}-line source (banner shift not corrected)`,
    );
    assert.equal(
      Math.min(...sourceLines),
      0,
      "inline map must map its first statement to source line 0",
    );
}
