import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the candidate relaxation keeps its own invalidation: a superseding
 * candidate that appears must still replace the generation.
 *
 * The recorded `missing` marker is state, not the absence of state, so the
 * negative twin of
 * `test_transformttsc_caches_one_compile_with_unproven_resolution_candidates`
 * is that creating the higher-priority spelling changes resolution and
 * therefore must recompile the project.
 *
 * 1. Deliver one module from a generation that recorded three missing candidates.
 * 2. Create the first candidate on disk.
 * 3. Deliver a sibling module and assert the plugin ran a second time.
 */
export async function test_transformttsc_invalidates_the_generation_when_a_candidate_appears(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 3,
    graphCandidates: 3,
    graphFanout: 4,
  });
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
  const runsBefore = fs.readFileSync(project.runLog, "utf8").length;
  assert.equal(runsBefore, 1);
  const candidate = path.join(project.root, "node_modules", "dep0", "index.ts");
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  fs.writeFileSync(candidate, "export const superseding = 1;\n", "utf8");
  await deliver(modules[1]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
