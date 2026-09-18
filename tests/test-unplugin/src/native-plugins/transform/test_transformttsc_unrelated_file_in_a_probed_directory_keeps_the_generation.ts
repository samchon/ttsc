import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createNestedUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies an unrelated file in a directory discovery probed does not
 * invalidate anything.
 *
 * This is the twin of the supersession case. The probes make a set of paths
 * matter, and a generation that woke for any neighbour of them would trade one
 * defect for a worse one, since config directories carry ordinary traffic.
 *
 * 1. Transform a project whose banner config was found above a probed middle
 *    directory.
 * 2. Create an unrelated file in the probed directory.
 * 3. Transform again and assert the generation is kept.
 */
export async function test_transformttsc_unrelated_file_in_a_probed_directory_keeps_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  const firstGeneration = [...cache.values()][0];

  fs.writeFileSync(
    path.join(middle, "unrelated.json"),
    JSON.stringify({ text: "IGNORED" }),
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );

  assert.ok(second);
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "a neighbour of a probed candidate must not replace the generation",
  );
  assert.match(second.code, /OUTER BANNER/);
}
