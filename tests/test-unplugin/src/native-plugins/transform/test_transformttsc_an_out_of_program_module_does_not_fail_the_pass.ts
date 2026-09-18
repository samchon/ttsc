import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";
import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";

/**
 * Verifies a module the compile has no output for does not fail the pass or
 * evict its generation.
 *
 * `selectTransformedSource` throws from three places, and only two of them say
 * anything about the generation. The third says one file has no output, an
 * ordinary condition for a module the bundle reaches but the tsconfig program
 * does not contain. Retaining that as a pass verdict would reject every later
 * module with an error about a file none of them asked for, and evicting the
 * generation would make each recompile the whole project to reach the same
 * answer (samchon/ttsc#1303). The generation compiled fine, so it is left where
 * it is.
 *
 * 1. Open a pass and deliver a project module.
 * 2. Deliver a file outside the program and assert it is left to the host while
 *    the generation survives.
 * 3. Deliver the remaining modules and assert they are served from that
 *    generation.
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
