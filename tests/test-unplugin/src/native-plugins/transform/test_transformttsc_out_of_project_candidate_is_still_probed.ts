import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a candidate whose spelling leaves the project subtree is still
 * probed.
 *
 * The negative twin of the notification proof at the boundary it declines at.
 * The chain that proves an absent candidate stops at the project's own root:
 * above that line the components belong to the machine rather than the project,
 * and a link along the part outside the subtree could move the candidate's
 * answer with nothing inside the bound to report it. Such a candidate therefore
 * keeps the probe it always had, and claiming it anyway would serve a
 * generation the appearance already superseded (samchon/ttsc#1261).
 *
 * 1. Stamp one candidate at an absolute spelling outside the project root, with
 *    watch registration left working so only the bound decides.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert that spelling was checked every time.
 */
export async function test_transformttsc_out_of_project_candidate_is_still_probed(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const outside = path.join(
    TestProject.tmpdir("ttsc-unplugin-outside-candidate-"),
    "index.ts",
  );
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    outOfProjectCandidate: outside,
  });
  const probes = { calls: 0 };
  const count = (location: string): void => {
    if (path.resolve(location) === path.resolve(outside)) probes.calls += 1;
  };
  const cache = createTtscTransformCache({
    exists: (location: string) => {
      count(location);
      return fs.existsSync(location);
    },
    lstat: (location: string) => {
      count(location);
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      count(location);
      return fs.readFileSync(location);
    },
    stat: (location: string) => {
      count(location);
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      count(location);
      return fs.statSync(location, { bigint: true });
    },
  });
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

  probes.calls = 0;
  for (const file of modules.slice(1)) {
    await deliver(file);
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  assert.ok(
    probes.calls > 0,
    "a candidate outside the project subtree must keep being checked on the filesystem",
  );
}
