import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a candidate's directory being replaced still invalidates.
 *
 * The case the chain watch exists for beside the retarget: a package manager
 * removes `node_modules/<package>` and lays a new tree down in its place, and
 * the new tree carries a spelling the resolver would now prefer. The watch the
 * candidate itself opened dies with the directory it was opened on, and a dead
 * watch reports nothing, so only the name being watched in the _parent_ says
 * that anything happened (samchon/ttsc#1261).
 *
 * 1. Create the candidate's directory empty, so the candidate is absent through a
 *    directory that exists and carries no realized input.
 * 2. Deliver one module to capture the generation.
 * 3. Remove that directory and recreate it with the candidate inside, then assert
 *    the next delivery recompiled.
 */
export async function test_transformttsc_recreated_candidate_directory_invalidates_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  // Fanout 1 keeps every realized edge target under `dep0`; the second
  // candidate points at `dep1`, which the fixture never creates, so the
  // directory below is the only thing between the candidate and its answer.
  const project = createCacheProject({
    fileCount: 3,
    graphCandidates: 2,
    graphFanout: 1,
  });
  const directory = path.join(project.root, "node_modules", "dep1");
  fs.mkdirSync(directory, { recursive: true });

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

  fs.rmSync(directory, { force: true, recursive: true });
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "index.ts"),
    "export const superseding = 1;\n",
    "utf8",
  );
  await deliver(modules[1]!);

  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "replacing the directory a candidate lives in must replace the generation",
  );
}
