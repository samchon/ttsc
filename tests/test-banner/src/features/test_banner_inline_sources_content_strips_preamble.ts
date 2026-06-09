import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { decodeSourceLines } from "../internal/decode-source-map";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: under `inlineSources` the embedded source
 * text matches the real file, with no banner and no line shift.
 *
 * `inlineSources` embeds the parsed source into the map's `sourcesContent`, and
 * that text is the preamble-injected source. If only `mappings` were corrected,
 * the embedded source would still carry the banner and be off by the preamble's
 * line count, so a debugger using sourcesContent would jump wrong. The host
 * strips the preamble from sourcesContent too; this pins it end-to-end through
 * the real binary (the unit test covers the function in isolation).
 *
 * 1. Build a project with `sourceMap` + `inlineSources` + a multi-line banner.
 * 2. Run `ttsc --emit`.
 * 3. Assert `sourcesContent[0]` equals the on-disk `src/main.ts` byte-for-byte (no
 *    banner), and the mappings still anchor at source line 0.
 */
export const test_banner_inline_sources_content_strips_preamble = () => {
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
        sourceMap: true,
        inlineSources: true,
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

  const map = JSON.parse(
    fs.readFileSync(path.join(root, "dist", "main.js.map"), "utf8"),
  );
  const onDisk = fs.readFileSync(path.join(root, "src", "main.ts"), "utf8");
  assert.ok(
    Array.isArray(map.sourcesContent) && map.sourcesContent.length > 0,
    "inlineSources must embed sourcesContent",
  );
  const embedded = map.sourcesContent[0];
  assert.doesNotMatch(
    embedded,
    /@packageDocumentation|Copyright|MIT License/,
    "sourcesContent must not contain the banner preamble",
  );
  assert.equal(
    embedded,
    onDisk,
    "embedded sourcesContent must match the on-disk source byte-for-byte",
  );

  const sourceLines = decodeSourceLines(map.mappings);
  assert.ok(sourceLines.length > 0, "map must contain mappings");
  assert.ok(
    Math.max(...sourceLines) < sourceLineCount,
    "no mapping may point past the real source",
  );
  assert.equal(
    Math.min(...sourceLines),
    0,
    "first statement must map to source line 0",
  );
};
