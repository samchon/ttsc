import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";
import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";

/**
 * Verifies a module the compile has no output for does not fail the whole pass.
 *
 * `selectTransformedSource` throws from three places, and only two of them say
 * anything about the generation. The third says one file has no output, which
 * is an ordinary condition for a module the bundle reaches but the tsconfig
 * program does not contain: `@ttsc/metro` treats it as "pass this file
 * through", and a bundler reaching one is a configuration, not a fault.
 *
 * Retaining that as a pass verdict would reject every later module of the pass
 * with an error naming a file none of them asked about. Evicting the generation
 * instead, which is what happened before any of this, makes every later module
 * recompile the whole project to reach the same answer, which is the cost
 * samchon/ttsc#1303 is about. Neither is right: the generation compiled fine
 * and simply has nothing for this one file, so it is left exactly where it is.
 * This is the boundary of what a pass verdict may cover.
 */
export async function test_transformttsc_an_out_of_program_module_does_not_fail_the_pass(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 3, graphFanout: 1 });
  const modules = projectModules(project.root);
  // Under the project root but outside the tsconfig's `include: ["src"]`, so
  // the program has no entry for it. Planted before the first delivery, since
  // creating it later would be a membership change instead.
  const outside = path.join(project.root, "outside", "helper.ts");
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, "export const helper = 1;\n", "utf8");

  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  api.beginTtscTransformBuild(cache);
  try {
    assert.ok(await deliver(modules[0]!));
    const generation = cachedGeneration(cache);

    assert.equal(
      await deliver(outside),
      undefined,
      "a module the program does not contain is left to the host, not failed",
    );
    assert.equal(
      cachedGeneration(cache),
      generation,
      "a generation that compiled fine must survive a module it has no output for",
    );

    for (const file of modules.slice(1)) {
      assert.ok(
        await deliver(file),
        `${path.basename(file)} must still be served after an out-of-program module`,
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
