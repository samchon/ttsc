import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the complete transform survives Darwin's high-descriptor spawn edge.
 *
 * On macOS, a process holding descriptors above a system threshold can fail to
 * spawn children or open watchers in ways a low-descriptor test never reaches.
 * Runtime probes, descriptor evaluation, the Go build, and the native execution
 * all spawn or open files, so each must survive it.
 *
 * 1. Skip unless the host is macOS.
 * 2. Open descriptors until the last one opened is at least 10,500.
 * 3. Run a build-scoped transform and assert it succeeds, then close every
 *    descriptor.
 */
export async function test_transformttsc_survives_high_darwin_descriptors(): Promise<void> {
  if (process.platform !== "darwin") return;
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1, graphFanout: 1 });
  const file = projectModules(project.root)[0]!;
  const cache = api.createTtscTransformCache();
  const descriptors: number[] = [];
  try {
    while ((descriptors.at(-1) ?? -1) < 10_500) {
      descriptors.push(fs.openSync("/dev/null", "r"));
    }
    api.beginTtscTransformBuild(cache);
    assert.ok(
      await api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        api.resolveOptions(),
        undefined,
        cache,
        { addWatchFile: () => undefined },
      ),
      "runtime probes, descriptor evaluation, Go build and native execution must survive high descriptors",
    );
  } finally {
    api.resetTtscTransformCache(cache);
    for (const descriptor of descriptors.reverse()) fs.closeSync(descriptor);
  }
}
