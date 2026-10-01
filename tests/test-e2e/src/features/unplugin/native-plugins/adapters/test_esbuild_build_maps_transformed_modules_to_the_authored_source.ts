import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { originalPositionFor } from "../../../../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../../../../internal/unplugin/internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../../../internal/unplugin/internal/transform-linked-completeness/createLinkedPluginProject";

const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");

/**
 * Verifies an esbuild build with source maps maps a ttsc-transformed module
 * back to its authored lines (samchon/ttsc#1392).
 *
 * Esbuild's `onLoad` returns contents only, so the adapter appends its map as
 * an inline `sourceMappingURL`, which esbuild composes into the output map.
 * Without it every position after `@ttsc/banner`'s block maps to the
 * transformed text.
 *
 * 1. Build a banner project's entry through the adapter with an external source
 *    map.
 * 2. Assert the output's `value` maps back to the entry's authored line and
 *    column, and the map carries the authored text.
 *
 * @evidence contracts/testing.md#behavioral-verification External output map maps generated value to main.ts authored coordinates and embeds original source text.
 * @evidence contracts/testing.md#independent-expectations positionOf uses original authored bytes; independent map decoder checks composed output, not adapter-generated expectations.
 * @evidence contracts/testing.md#distinguishing-cases Banner-shifted TypeScript with external map and sourcesContent; other host map cases are complementary.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_esbuild_build_maps_transformed_modules_to_the_authored_source is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Real esbuild composes inline adapter map into external output map through onLoad.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: external output map maps generated value to main.ts authored coordinates and embeds original source text. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_esbuild_build_maps_transformed_modules_to_the_authored_source(): Promise<void> {
  const unpluginEsbuild =
    await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
  const project = createLinkedPluginProject(["banner"]);
  const source = fs.readFileSync(project.main, "utf8");
  const result = await esbuild.build({
    absWorkingDir: project.root,
    bundle: false,
    entryPoints: [project.main],
    format: "esm",
    logLevel: "silent",
    outdir: path.join(project.root, "dist"),
    plugins: [unpluginEsbuild()],
    sourcemap: "external",
    write: false,
  });
  const code = result.outputFiles.find((file: { path: string }) =>
    file.path.endsWith(".js"),
  ).text as string;
  const map = JSON.parse(
    result.outputFiles.find((file: { path: string }) =>
      file.path.endsWith(".js.map"),
    ).text,
  );
  const generated = positionOf(code, "value");
  const original = originalPositionFor(map, generated.line, generated.column);
  assert.ok(original, "the output's `value` is mapped");
  assert.equal(path.basename(original.source), "main.ts");
  assert.deepEqual(
    { column: original.column, line: original.line },
    positionOf(source, "value"),
  );
  assert.equal(
    map.sourcesContent[map.sources.indexOf(original.source)],
    source,
  );
}
