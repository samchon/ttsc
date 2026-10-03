import assert from "node:assert/strict";

import { Scenarios } from "../../../internal/Scenarios";
import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";
import { TestBanner } from "../../../internal/banner/internal/TestBanner";
import { decodeSourceLines } from "../../../internal/banner/internal/decode-source-map";

/**
 * Verifies the @ttsc/banner plugin: source-map lines still address the authored
 * source after the preamble is inserted in the shared external-map Program.
 *
 * The four-line banner adds eight lines to the output. Maps that were not
 * shifted back would point beyond the authored source. The existing combined
 * Program owns native external-map writing, source byte embedding and CJS
 * banner loading. TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes
 * owns the original inline and removeComments output assertions directly in the
 * compiler process, with identical authored source and banner text.
 *
 * 1. Read the external-map output produced by the preceding shebang scenario.
 * 2. Assert single banners, sidecar comments and embedded authored source bytes.
 * 3. Decode both maps and compare their range and zero anchoring independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Real emits must carry one banner in JavaScript and declarations, keep every decoded external-map line below the source line count with the minimum at zero, embed the authored source bytes and exclude banner text from maps.
 * @evidence contracts/testing.md#independent-expectations The authored source line count, the source map v3 format and an independent VLQ decoder define the bounds; the expected shift is not computed by the plugin.
 * @evidence contracts/testing.md#distinguishing-cases External maps with inlineSources connect actual source embedding and native writer paths. Maximum line below count detects an uncorrected shift and minimum zero detects an over-correction. The owning Go map unit retains inline output and removeComments banner absence in two incompatible actual compiler modes.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; real compiler map output is inspected. TestAuthoredRegionMapsPositionsAroundThePreamble owns authored-position correction and TestEmitWithPluginTransformerCorrectsPreambleShift owns the in-process transformer emit route. This scenario connects the linked native utility writer to external JS and declaration maps and their actual files. TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes owns actual inline and removeComments emission without another product process.
 * @evidence contracts/e2e.md#necessary-boundary Emit, utility-host map writing and the registered banner cooperate through the public native launcher. The direct map unit uses equivalent native JSON banner text; it does not establish installed CJS loading, the native utility writer's external files or embedded source byte identity, which remain here.
 * @evidence contracts/e2e.md#shared-execution The shebang scenario prepares the combined external-map output once with banner, paths and strip; this scenario reads it without another emit. Former inline/removeComments inputs have direct Go mode owners, each with its own compiler load and JSON configuration rather than another product process or Node loader. Authored owners do not establish measured savings or actual runtime coverage.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity External-map output is shared after the preceding synchronous emit result returns; a missing output fails. Baseline and configuration remain read only. The direct Go map unit materializes a fresh root and supplies its own plugins-json argument for each mode; neither declaration certifies arbitrary descendant shutdown or Program-object reuse.
 * @evidence contracts/e2e.md#preserved-coverage External maps, embedded-source byte equality, sidecar comments and map-range assertions remain here. Original inline-map and removeComments banner-absence/map-range literals have an authored owner in packages/banner/test/unit/utility_banner_maps_preserve_authored_lines_across_emit_modes_test.go::TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes. That direct unit uses JSON configuration and two compiler modes, not installed CJS loading; its body and address are not an actual execution certificate. Historical execution before the earlier duplicate removal is not independently verified by this declaration.
 */
export async function case_banner_source_maps_point_at_original_source(
  workspace: UtilityWorkspace.IWorkspace,
): Promise<void> {
  const sourceLineCount = UtilityWorkspace.read(
    workspace,
    "external-maps",
    "../shared/main.ts",
  ).split("\n").length;

  await Scenarios.collect("banner source maps", [
    [
      "external_maps",
      () => {
        const external = "external-maps";
        const javascript = UtilityWorkspace.read(
          workspace,
          external,
          "dist/main.js",
        );
        const declaration = UtilityWorkspace.read(
          workspace,
          external,
          "dist/main.d.ts",
        );
        TestBanner.assertSingleBanner(javascript, TestBanner.SHARED_TEXT);
        TestBanner.assertSingleBanner(declaration, TestBanner.SHARED_TEXT);
        assert.match(javascript, /\n\/\/# sourceMappingURL=main\.js\.map$/);
        assert.match(declaration, /\n\/\/# sourceMappingURL=main\.d\.ts\.map$/);
        const embedded = JSON.parse(
          UtilityWorkspace.read(workspace, external, "dist/main.js.map"),
        );
        assert.ok(
          Array.isArray(embedded.sourcesContent) &&
            embedded.sourcesContent.length > 0,
          "inlineSources must embed sourcesContent",
        );
        assert.doesNotMatch(
          embedded.sourcesContent[0],
          /@packageDocumentation|Copyright|MIT License/,
        );
        assert.equal(
          embedded.sourcesContent[0],
          UtilityWorkspace.read(workspace, external, "../shared/main.ts"),
          "embedded sourcesContent must match authored source byte-for-byte",
        );
        for (const mapName of ["main.js.map", "main.d.ts.map"]) {
          const text = UtilityWorkspace.read(
            workspace,
            external,
            `dist/${mapName}`,
          );
          assert.doesNotMatch(
            text,
            /@packageDocumentation|Copyright|MIT License/,
            `${mapName} must not contain banner text`,
          );
          assertMapInRange(
            mapName,
            JSON.parse(text).mappings,
            sourceLineCount,
            JSON.parse(text).version,
          );
        }
      },
    ],
  ]);
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
  assert.equal(
    Math.min(...lines),
    0,
    `${name} must map its first statement to source line 0`,
  );
}
