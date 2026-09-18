import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies samchon/ttsc#1261: a delivery stops probing an absent resolution
 * candidate the generation's watcher already covers.
 *
 * A missing candidate is the one input no proof can be memoized for. Its
 * metadata cannot be read, so the signature that stands in for every other
 * input's comparison never applies, and each delivery that reaches it probes
 * the filesystem again — `modules x candidates` for one build, and the only
 * per-delivery filesystem work a declaring producer has left. Watching the name
 * answers it once for the whole generation instead, through the channel that
 * already proves project membership.
 *
 * 1. Build a project whose envelope stamps missing candidates.
 * 2. Deliver one module so the generation is captured, then reset the counters.
 * 3. Deliver the remaining modules and assert nothing touched a candidate path.
 */
export async function test_transformttsc_notified_absent_candidate_is_not_reprobed(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const graphCandidates = 3;
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates,
    graphFanout: 4,
  });
  const candidates = new Set(
    Array.from({ length: graphCandidates }, (_, index) =>
      path.resolve(
        path.join(project.root, "node_modules", `dep${index}`, "index.ts"),
      ),
    ),
  );
  const probes = { calls: 0 };
  const count = (location: string): void => {
    if (candidates.has(path.resolve(location))) probes.calls += 1;
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
  assert.equal(
    probes.calls,
    0,
    "a candidate the generation watches must cost no filesystem call per delivery",
  );
}
