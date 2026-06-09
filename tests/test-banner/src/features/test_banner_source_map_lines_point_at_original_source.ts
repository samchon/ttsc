import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { decodeSourceLines } from "../internal/decode-source-map";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: emitted source maps point at the real
 * source lines, not the banner-shifted ones.
 *
 * The banner is injected at the SOURCE level (sourcePreambleFS prepends it
 * before TypeScript-Go parses), which shifts every recorded source coordinate
 * down by the banner's line count. Left unpatched, every `.js.map` /
 * `.d.ts.map` mapping for real code points that many lines too deep — onto
 * blank lines past the end of the on-disk source — so debugging jumps to the
 * wrong place. The older banner test only checked the banner text was absent
 * from the maps, which does NOT catch the line shift. This decodes the mappings
 * and pins every referenced source line back inside the real file.
 *
 * 1. Build a multi-line project with `sourceMap`, `declaration`, and
 *    `declarationMap`, plus a multi-line banner so the shift would be large.
 * 2. Run `ttsc --emit`.
 * 3. Decode `.js.map` and `.d.ts.map`; assert no mapping references a source line
 *    at/after EOF, the first statement maps to source line 0, and the banner
 *    text never leaks into the maps.
 */
export const test_banner_source_map_lines_point_at_original_source = () => {
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

  for (const mapName of ["main.js.map", "main.d.ts.map"]) {
    const mapText = fs.readFileSync(path.join(root, "dist", mapName), "utf8");
    assert.doesNotMatch(
      mapText,
      /@packageDocumentation|Copyright|MIT License/,
      `${mapName} must not contain banner text`,
    );
    const map = JSON.parse(mapText);
    assert.equal(map.version, 3, `${mapName} must be a v3 source map`);

    const sourceLines = decodeSourceLines(map.mappings);
    assert.ok(
      sourceLines.length > 0,
      `${mapName} must contain at least one mapping`,
    );
    // The off-by-N bug pushes every mapping past the end of the real source.
    const maxLine = Math.max(...sourceLines);
    assert.ok(
      maxLine < sourceLineCount,
      `${mapName} maps to source line ${maxLine}, beyond the ${sourceLineCount}-line source (banner shift not corrected)`,
    );
    // The first emitted statement must still anchor at the first source line.
    assert.equal(
      Math.min(...sourceLines),
      0,
      `${mapName} must map its first statement to source line 0`,
    );
  }
};
