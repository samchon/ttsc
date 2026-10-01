import assert from "node:assert/strict";

import { decodeSourceLines } from "../../../internal/decode-source-map";
import { bannerMapBoundaryResult } from "../../../internal/banner-map-boundary";

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
 *
 * @evidence contracts/testing.md#behavioral-verification External JS map sourcesContent must equal authored disk bytes, omit banner text and retain nonempty mappings starting at 0 below source EOF.
 * @evidence contracts/testing.md#independent-expectations The immutable authored source is an independent byte oracle; zero-based source lines establish mapping bounds.
 * @evidence contracts/testing.md#distinguishing-cases Embedded bytes and source coordinates are checked separately, rejecting a map whose positions are fixed while its source text remains shifted.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_inline_sources_content_strips_preamble entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native emit and source-map postprocessing must remove the source preamble from embedded text, not merely map coordinates.
 * @evidence contracts/e2e.md#shared-execution The external map and sourcesContent cases reuse one compile with declarations, declarationMap, sourceMap and inlineSources enabled; assertions keep separate named entries. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity bannerMapBoundaryResult owns one fixed project, captures immutable map/source bytes and removes the project in finally on success or failure. Consumers share that completed output or initial preparation error within one process; they do not mutate sources or configuration.
 * @evidence contracts/e2e.md#preserved-coverage External JS map sourcesContent must equal authored disk bytes, omit banner text and retain nonempty mappings starting at 0 below source EOF. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_inline_sources_content_strips_preamble() {
  const prepared = bannerMapBoundaryResult();
  const sourceLineCount = prepared.source.split("\n").length;

  const map = JSON.parse(prepared.javascriptMap);
  const onDisk = prepared.source;
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
}
