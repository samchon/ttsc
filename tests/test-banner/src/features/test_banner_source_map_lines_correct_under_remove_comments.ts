import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

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
 */
export const test_banner_source_map_lines_correct_under_remove_comments =
  () => {
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
  };

/**
 * Decodes the cumulative source-line field (the 3rd VLQ field) of every mapping
 * segment in a source map `mappings` string. Source line is cumulative across
 * the whole string; segments without a source position are skipped.
 */
function decodeSourceLines(mappings: string): number[] {
  const BASE64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const decodeSegment = (segment: string): number[] => {
    const fields: number[] = [];
    let shift = 0;
    let value = 0;
    for (const char of segment) {
      const digit = BASE64.indexOf(char);
      const continuation = digit & 32;
      value += (digit & 31) << shift;
      if (continuation) {
        shift += 5;
        continue;
      }
      fields.push(value & 1 ? -(value >> 1) : value >> 1);
      shift = 0;
      value = 0;
    }
    return fields;
  };

  const lines: number[] = [];
  let sourceLine = 0;
  for (const group of mappings.split(";")) {
    if (group === "") continue;
    for (const segment of group.split(",")) {
      if (segment === "") continue;
      const fields = decodeSegment(segment);
      const sourceLineDelta = fields[2];
      if (sourceLineDelta === undefined) continue;
      sourceLine += sourceLineDelta;
      lines.push(sourceLine);
    }
  }
  return lines;
}
