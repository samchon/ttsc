import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a replayed terminal verdict confirms its environment once per
 * request wave, by metadata, instead of re-reading the project per module
 * (samchon/ttsc#1398).
 *
 * While a generation that could not be captured is replayed, every delivery
 * asked whether the environment had changed by walking and re-reading every
 * project file and every recorded dependency. A page load of hundreds of
 * modules then re-read the project hundreds of times, exactly while the user
 * waited for the error overlay.
 *
 * 1. Fail a forty-module project terminally, then deliver every module
 *    concurrently, and assert the wave reads fewer files than it has modules.
 * 2. Edit a project source and assert the next delivery recompiles.
 */
export async function test_transformttsc_terminal_verdict_is_confirmed_once_per_wave(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 40,
    graphFanout: 12,
    unprovenGraphInputs: 12,
  });
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
  });
  const options = resolveOptions();
  const modules = projectModules(project.root);
  const runs = () => fs.readFileSync(project.runLog, "utf8").length;
  const wave = () =>
    Promise.allSettled(
      modules.map((file) =>
        transformTtsc(
          file,
          fs.readFileSync(file, "utf8"),
          options,
          undefined,
          cache,
        ),
      ),
    );

  const first = await wave();
  assert.ok(first.every((entry) => entry.status === "rejected"));
  assert.equal(runs(), 2, "the terminal verdict costs its bounded attempts");
  await new Promise((resolve) => setImmediate(resolve));

  reads = 0;
  const replayed = await wave();
  assert.ok(replayed.every((entry) => entry.status === "rejected"));
  assert.equal(runs(), 2, "the replayed wave compiles nothing");
  assert.ok(
    reads < modules.length,
    `one confirmation serves the wave, by metadata: ${reads} reads for ${modules.length} modules`,
  );

  await new Promise((resolve) => setImmediate(resolve));
  fs.writeFileSync(
    modules[1]!,
    `${fs.readFileSync(modules[1]!, "utf8")}// edited\n`,
  );
  await assert.rejects(
    transformTtsc(
      modules[2]!,
      fs.readFileSync(modules[2]!, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(runs(), 4, "an edit is still seen on the next turn");
}
