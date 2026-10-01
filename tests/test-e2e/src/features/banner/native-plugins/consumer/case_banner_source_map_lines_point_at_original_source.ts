import assert from "node:assert/strict";

import { TestBanner } from "../../../../internal/banner/internal/TestBanner";

import { decodeSourceLines } from "../../../../internal/banner/internal/decode-source-map";
import { bannerMapBoundaryResult } from "../../../../internal/banner/internal/banner-map-boundary";

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
 *
 * @evidence contracts/testing.md#behavioral-verification JS and declaration outputs each retain one multiline banner and their map trailer; v3 maps omit banner text, embed exact authored JS source and contain nonempty mappings from line 0 below authored EOF.
 * @evidence contracts/testing.md#independent-expectations Literal source lines and the source-map v3 contract define bounds independently of preamble correction.
 * @evidence contracts/testing.md#distinguishing-cases Both map kinds retain coordinate and text checks; empty maps and past-EOF shifts fail.
 * @evidence contracts/testing.md#execution-ownership This case_banner_source_map_lines_point_at_original_source scene is called by test_banner_native_boundary_batch through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native source preamble and JS/declaration map serializers must publish corrected authored coordinates.
 * @evidence contracts/e2e.md#shared-execution Emit text, map trailers, embedded source and coordinate assertions share one compile with declarations, declarationMap, sourceMap and inlineSources enabled. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity bannerMapBoundaryResult owns one fixed project, captures immutable map/source bytes and removes the project in finally on success or failure. Consumers share that completed output or initial preparation error within one process; they do not mutate sources or configuration.
 * @evidence contracts/e2e.md#preserved-coverage JS and declaration outputs each retain one multiline banner and their map trailer; v3 maps omit banner text, embed exact authored JS source and contain nonempty mappings from line 0 below authored EOF. This entry retains the former injection and inlineSources assertions as well as both coordinate checks; different literal multiline text introduces no distinct loader or emit branch. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function case_banner_source_map_lines_point_at_original_source() {
  const prepared = bannerMapBoundaryResult();
  const sourceLineCount = prepared.source.split("\n").length;

  const bannerText = "Copyright\nMIT License\nthird line\nfourth line";
  TestBanner.assertSingleBanner(prepared.javascript, bannerText);
  TestBanner.assertSingleBanner(prepared.declaration, bannerText);
  assert.match(prepared.javascript, /\n\/\/# sourceMappingURL=main\.js\.map$/);
  assert.match(prepared.declaration, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
  const embeddedMap = JSON.parse(prepared.javascriptMap);
  assert.ok(Array.isArray(embeddedMap.sourcesContent) && embeddedMap.sourcesContent.length > 0,
    "inlineSources must embed sourcesContent");
  assert.doesNotMatch(embeddedMap.sourcesContent[0], /@packageDocumentation|Copyright|MIT License/);
  assert.equal(embeddedMap.sourcesContent[0], prepared.source,
    "embedded sourcesContent must match authored source byte-for-byte");

  for (const mapName of ["main.js.map", "main.d.ts.map"]) {
    const mapText = mapName === "main.js.map" ? prepared.javascriptMap : prepared.declarationMap;
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
}
