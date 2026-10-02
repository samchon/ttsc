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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; real compiler map output is inspected. TestAuthoredRegionMapsPositionsAroundThePreamble owns authored-position correction and TestEmitWithPluginTransformerCorrectsPreambleShift owns the in-process transformer emit route. This scenario connects the installed utility writer to external JS and declaration maps and their actual files. TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes owns actual inline and removeComments emission without another product process.
 * @evidence contracts/e2e.md#necessary-boundary Emit, utility-host map writing and the registered banner cooperate through the public native launcher. The direct map unit uses equivalent native JSON banner text; it does not establish installed CJS loading, the native utility writer's external files or embedded source byte identity, which remain here.
 * @evidence contracts/e2e.md#shared-execution The shebang scenario prepares the combined external-map output once with banner, paths and strip. This scenario reads that same output. Two former inline/removeComments product invocations and dedicated configs are removed after their literal output checks pass in the direct owning Go map unit; its two incompatible Programs start no product or Node child.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity External-map output is shared with the preceding shebang scenario after actual compiler completion; a missing output fails. Baseline and configuration remain read only. The Go map unit owns separate fresh temporary emit roots and restores linked-plugin manifest state between its two Programs.
 * @evidence contracts/e2e.md#preserved-coverage External maps, embedded-source byte equality, sidecar comments and map-range assertions remain here. Original inline-map and removeComments banner-absence/map-range literals moved to TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes, whose actual two-mode whole run passed before these duplicate native emits were removed.
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
