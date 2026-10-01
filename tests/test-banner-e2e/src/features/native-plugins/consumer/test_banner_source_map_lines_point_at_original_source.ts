import assert from "node:assert/strict";

import { decodeSourceLines } from "../../../internal/decode-source-map";
import { bannerMapBoundaryResult } from "../../../internal/banner-map-boundary";

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
 * @evidence contracts/testing.md#behavioral-verification JS and declaration maps must be v3, omit banner text, contain nonempty mappings from line 0 and remain below authored EOF.
 * @evidence contracts/testing.md#independent-expectations Literal source lines and the source-map v3 contract define bounds independently of preamble correction.
 * @evidence contracts/testing.md#distinguishing-cases Both map kinds retain coordinate and text checks; empty maps and past-EOF shifts fail.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_source_map_lines_point_at_original_source entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native source preamble and JS/declaration map serializers must publish corrected authored coordinates.
 * @evidence contracts/e2e.md#shared-execution The external map and sourcesContent cases reuse one compile with declarations, declarationMap, sourceMap and inlineSources enabled; each named consumer checks its own results. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity bannerMapBoundaryResult owns one fixed project, captures immutable map/source bytes and removes the project in finally on success or failure. Consumers share that completed output or initial preparation error within one process; they do not mutate sources or configuration.
 * @evidence contracts/e2e.md#preserved-coverage JS and declaration maps must be v3, omit banner text, contain nonempty mappings from line 0 and remain below authored EOF. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_source_map_lines_point_at_original_source() {
  const prepared = bannerMapBoundaryResult();
  const sourceLineCount = prepared.source.split("\n").length;

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
