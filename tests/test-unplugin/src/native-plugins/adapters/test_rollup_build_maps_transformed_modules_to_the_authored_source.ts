import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { originalPositionFor } from "../../internal/source-map/originalPositionFor";
import { positionOf } from "../../internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";

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
