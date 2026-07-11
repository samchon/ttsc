import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inlineServedSourceMap } from "../../../../../packages/ttsc/lib/launcher/internal/servedSourceMap.js";

/**
 * Verifies the source-map inliner's boundary behavior on the map shapes a
 * served emit can carry beyond the common single-source external case (issue
 * #353).
 *
 * These are the latent-risk edges the spawned runs cannot reach on a platform
 * whose tsgo always emits an LF, single-source external map: a served emit with
 * no comment must pass through untouched; an emit whose sibling map is missing
 * must have its dangling comment stripped (so Node caches no `data: null`
 * script); an already-inline map must be absolutized without being double-
 * wrapped; and a multi-source map must have each relative source absolutized
 * against the map's own directory.
 *
 * 1. Assert text without a trailer is returned unchanged.
 * 2. Assert a missing-sibling external trailer is stripped entirely.
 * 3. Assert an already-inline `data:` map is rewritten to one trailer with an
 *    absolute source.
 * 4. Assert a two-source map absolutizes both entries against the map directory.
 */
export const test_ttsx_inline_source_map_handles_absent_inline_and_multi_source_maps =
  () => {
    const dir = TestProject.tmpdir("ttsx-inline-map-edges-");
    const sourceFile = path.join(dir, "src", "lib.ts");

    // 1. No trailer → unchanged.
    const plain = "exports.x = 1;\n";
    assert.equal(
      inlineServedSourceMap(plain, path.join(dir, "plain.js"), sourceFile),
      plain,
      "text without a sourceMappingURL trailer must be returned unchanged",
    );

    // 2. External trailer whose sibling map is missing → comment stripped.
    const dangling = "exports.x = 1;\n//# sourceMappingURL=missing.js.map";
    const stripped = inlineServedSourceMap(
      dangling,
      path.join(dir, "missing.js"),
      sourceFile,
    );
    assert.equal(
      stripped,
      "exports.x = 1;",
      "a dangling external trailer must be stripped so no data:null is cached",
    );

    // 3. Already-inline data URI → absolutized, single trailer.
    const inlineMap = Buffer.from(
      JSON.stringify({
        version: 3,
        file: "a.js",
        sources: ["../src/lib.ts"],
        names: [],
        mappings: "AAAA",
      }),
      "utf8",
    ).toString("base64");
    const alreadyInline = `exports.x = 1;\n//# sourceMappingURL=data:application/json;base64,${inlineMap}`;
    const reinlined = inlineServedSourceMap(
      alreadyInline,
      path.join(dir, "inline.js"),
      sourceFile,
    );
    assert.equal(
      (reinlined.match(/sourceMappingURL=data:/g) ?? []).length,
      1,
      "an already-inline map must not be double-wrapped",
    );
    assert.deepEqual(
      decodeInlineMap(reinlined).sources,
      [pathToFileURL(sourceFile).href],
      "an already-inline single-source map must be absolutized",
    );

    // 4. Multi-source map → each relative source absolutized against map dir.
    const multiEmitted = path.join(dir, "multi.js");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      `${multiEmitted}.map`,
      JSON.stringify({
        version: 3,
        file: "multi.js",
        sourceRoot: "",
        sources: ["../src/a.ts", "../src/b.ts"],
        names: [],
        mappings: "AAAA",
      }),
    );
    const multiOut = inlineServedSourceMap(
      "exports.x = 1;\n//# sourceMappingURL=multi.js.map",
      multiEmitted,
      undefined,
    );
    assert.deepEqual(
      decodeInlineMap(multiOut).sources,
      [
        pathToFileURL(path.resolve(dir, "../src/a.ts")).href,
        pathToFileURL(path.resolve(dir, "../src/b.ts")).href,
      ],
      "each source of a multi-source map must be absolutized against the map dir",
    );
  };

function decodeInlineMap(text: string): Record<string, unknown> {
  const match = text.match(
    /sourceMappingURL=data:application\/json;[^,]*,(.+)$/,
  );
  assert.ok(match, "output must carry a base64 data URI");
  return JSON.parse(Buffer.from(match[1]!, "base64").toString("utf8"));
}
