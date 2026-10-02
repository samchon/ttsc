import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { originalPositionFor } from "../../../../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../../../../internal/unplugin/internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../../../internal/unplugin/internal/transform-linked-completeness/createLinkedPluginProject";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;
const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");

/**
 * Verifies a Rollup build with source maps maps a ttsc-transformed module back
 * to its authored lines, with no broken-map warning (samchon/ttsc#1392).
 *
 * A transform that changes code without returning a map makes Rollup report
 * `SOURCEMAP_BROKEN` and publish a map that points at the transformed text.
 * `@ttsc/banner` shifts every line of the entry. A type-stripping plugin runs
 * after the adapter, the way a real TypeScript build chains transforms, so the
 * adapter's map must compose with the next plugin's.
 *
 * 1. Bundle a banner project's entry through the adapter and a type-stripping
 *    plugin, and generate with `sourcemap: true`.
 * 2. Assert no `SOURCEMAP_BROKEN` warning, and the output's `value` maps back to
 *    the entry's authored line and column.
 *
 * @evidence contracts/testing.md#behavioral-verification Rollup plus later esbuild type stripping yields no SOURCEMAP_BROKEN and maps value to authored main.ts coordinates.
 * @evidence contracts/testing.md#independent-expectations Original source positions and independent map decoder fix oracle outside adapter map generation.
 * @evidence contracts/testing.md#distinguishing-cases Banner line shift followed by second transform composition; missing-map warning is explicitly rejected.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_rollup_build_maps_transformed_modules_to_the_authored_source is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup source-map composition with independent type-stripping plugin checks chaining.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Bundles close in finally; mutable sources and retained caches belong to this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: rollup plus later esbuild type stripping yields no SOURCEMAP_BROKEN and maps value to authored main.ts coordinates. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_rollup_build_maps_transformed_modules_to_the_authored_source(): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const project = createLinkedPluginProject(["banner"]);
  const source = fs.readFileSync(project.main, "utf8");
  const warnings: { code?: string; plugin?: string }[] = [];
  const bundle = await rollup({
    external: () => true,
    input: project.main,
    onwarn: (warning: { code?: string; plugin?: string }) => {
      warnings.push(warning);
    },
    plugins: [
      unpluginRollup(),
      {
        name: "strip-types",
        async transform(code: string, id: string) {
          if (!id.endsWith(".ts")) return null;
          const stripped = await esbuild.transform(code, {
            format: "esm",
            loader: "ts",
            sourcefile: id,
            sourcemap: true,
          });
          return { code: stripped.code, map: stripped.map };
        },
      },
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: "esm",
      sourcemap: true,
    });
    assert.deepEqual(
      warnings.filter((warning) => warning.code === "SOURCEMAP_BROKEN"),
      [],
    );
    const [chunk] = output;
    const generated = positionOf(chunk.code, "value");
    const original = originalPositionFor(
      chunk.map,
      generated.line,
      generated.column,
    );
    assert.ok(original, "the output's `value` is mapped");
    assert.equal(path.basename(original.source), "main.ts");
    assert.deepEqual(
      { column: original.column, line: original.line },
      positionOf(source, "value"),
    );
  } finally {
    await bundle.close();
  }
}
