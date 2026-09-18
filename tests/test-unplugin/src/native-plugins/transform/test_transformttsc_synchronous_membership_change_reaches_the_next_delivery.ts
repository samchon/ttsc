import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies samchon/ttsc#1272: a membership change made between two deliveries
 * is seen by the second one.
 *
 * This is what the mutation-settle barrier exists for. A write returns before
 * its watch event is applied, so a delivery that read the tracker's verdict
 * immediately would validate against a watcher that had not been told, and
 * serve a generation the new file already invalidated. The barrier used to be a
 * fixed wait guessing at that crossing; it is now the watcher's own
 * acknowledgement, and this case pins that the guarantee did not move with it.
 *
 * 1. Deliver one module so the generation is captured.
 * 2. Write a new source file into the project, synchronously.
 * 3. Deliver another module and assert the project was recompiled.
 */
export async function test_transformttsc_synchronous_membership_change_reaches_the_next_delivery(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 2 });
  const cache = createTtscTransformCache();
  const modules = projectModules(project.root);
  const options = resolveOptions();
  const deliver = async (file: string): Promise<void> => {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
  };

  await deliver(modules[0]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);

  fs.writeFileSync(
    path.join(project.root, "src", "added.ts"),
    'export const added: string = "PROBE";\n',
    "utf8",
  );
  await deliver(modules[1]!);

  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "a file created between two deliveries must reach the watcher before the second one validates",
  );
}
