import assert from "node:assert/strict";

import { TestBanner } from "../../../internal/banner/internal/TestBanner";
import { decodeSourceLines } from "../../../internal/banner/internal/decode-source-map";
import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: source-map lines still address the authored
 * source after the preamble is inserted, in each map mode.
 *
 * The four-line banner adds eight lines to the output. Maps that were not
 * shifted back would point beyond the end of the five-line source. Three
 * projects compile the same baseline with external maps and embedded sources,
 * with an inline map, and with `removeComments`, where the preamble must be
 * absent from JavaScript and declarations yet the maps remain in range.
 *
 * 1. Emit the external-map project and assert banner, sidecar comments,
 *    embedded sources and in-range, first-line-anchored maps.
 * 2. Emit the inline-map project and decode its embedded base64 map.
 * 3. Emit the removeComments project and assert no banner in outputs while its
 *    maps stay in range.
 *
 * @evidence contracts/testing.md#behavioral-verification Real emits must carry one banner in JavaScript and declarations, keep every decoded mapping line below the source line count with the minimum at zero for external, inline and removeComments outputs, embed the authored source bytes and exclude banner text from maps.
 * @evidence contracts/testing.md#independent-expectations The authored source line count, the source map v3 format and an independent VLQ decoder define the bounds; the expected shift is not computed by the plugin.
 * @evidence contracts/testing.md#distinguishing-cases External maps with inlineSources, inline maps and removeComments are three distinct emit modes; maximum line below count detects an uncorrected shift and minimum zero detects an over-correction; banner absence under removeComments is the negative.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_banner with the shared workspace; real compiler map output is inspected, while preamble and line-shift calculation belong to Go units.
 * @evidence contracts/e2e.md#necessary-boundary Emit, map generation and banner insertion cooperate only in a real native compile; direct preamble units cannot show the maps written to disk are in range.
 * @evidence contracts/e2e.md#shared-execution All three projects compile one shared baseline and configuration; the compiler options (external, inline, removeComments) are mutually exclusive in one emit, so three emits remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each project writes its own dist directory and the baseline and configuration are read only; nothing is reset between emits because no output is shared.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former external-map, embedded-source, sidecar-comment, inline-map, removeComments banner-absence and map-range assertions at the same strictness.
 */
export function case_banner_source_maps_point_at_original_source(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const sourceLineCount = UtilityWorkspace.read(workspace, "external-maps", "../shared/main.ts").split("\n").length;

  const external = "external-maps";
  const emit = UtilityWorkspace.emit(workspace, external);
  assert.equal(emit.status, 0, emit.stderr);
  const javascript = UtilityWorkspace.read(workspace, external, "dist/main.js");
  const declaration = UtilityWorkspace.read(workspace, external, "dist/main.d.ts");
  TestBanner.assertSingleBanner(javascript, TestBanner.SHARED_TEXT);
  TestBanner.assertSingleBanner(declaration, TestBanner.SHARED_TEXT);
  assert.match(javascript, /\n\/\/# sourceMappingURL=main\.js\.map$/);
  assert.match(declaration, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
  const embedded = JSON.parse(UtilityWorkspace.read(workspace, external, "dist/main.js.map"));
  assert.ok(
    Array.isArray(embedded.sourcesContent) && embedded.sourcesContent.length > 0,
    "inlineSources must embed sourcesContent",
  );
  assert.doesNotMatch(embedded.sourcesContent[0], /@packageDocumentation|Copyright|MIT License/);
  assert.equal(
    embedded.sourcesContent[0],
    UtilityWorkspace.read(workspace, external, "../shared/main.ts"),
    "embedded sourcesContent must match authored source byte-for-byte",
  );
  for (const mapName of ["main.js.map", "main.d.ts.map"]) {
    const text = UtilityWorkspace.read(workspace, external, `dist/${mapName}`);
    assert.doesNotMatch(text, /@packageDocumentation|Copyright|MIT License/, `${mapName} must not contain banner text`);
    assertMapInRange(mapName, JSON.parse(text).mappings, sourceLineCount, JSON.parse(text).version);
  }

  const inline = UtilityWorkspace.emit(workspace, "inline-map");
  assert.equal(inline.status, 0, inline.stderr);
  const match = UtilityWorkspace.read(workspace, "inline-map", "dist/main.js")
    .match(/sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match?.[1], "emitted JS must carry an inline base64 source map");
  const inlineMap = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  assertMapInRange("inline map", inlineMap.mappings, sourceLineCount, inlineMap.version);

  const stripped = UtilityWorkspace.emit(workspace, "remove-comments");
  assert.equal(stripped.status, 0, stripped.stderr);
  assert.doesNotMatch(
    UtilityWorkspace.read(workspace, "remove-comments", "dist/main.js"),
    /@packageDocumentation|Copyright/,
    "removeComments must strip the banner from the .js",
  );
  assert.doesNotMatch(
    UtilityWorkspace.read(workspace, "remove-comments", "dist/main.d.ts"),
    /@packageDocumentation|Copyright|MIT License/,
    "removeComments must strip the banner from the declaration",
  );
  for (const mapName of ["main.js.map", "main.d.ts.map"]) {
    const map = JSON.parse(UtilityWorkspace.read(workspace, "remove-comments", `dist/${mapName}`));
    assertMapInRange(mapName, map.mappings, sourceLineCount, map.version);
  }
}

function assertMapInRange(
  name: string,
  mappings: string,
  sourceLineCount: number,
  version: number,
): void {
  assert.equal(version, 3, `${name} must be a v3 source map`);
  const lines = decodeSourceLines(mappings);
  assert.ok(lines.length > 0, `${name} must contain at least one mapping`);
  const maxLine = Math.max(...lines);
  assert.ok(
    maxLine < sourceLineCount,
    `${name} maps to source line ${maxLine}, beyond the ${sourceLineCount}-line source (banner shift not corrected)`,
  );
  assert.equal(Math.min(...lines), 0, `${name} must map its first statement to source line 0`);
}
