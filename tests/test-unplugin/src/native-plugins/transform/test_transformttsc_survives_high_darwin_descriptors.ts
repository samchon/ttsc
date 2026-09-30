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
 *
 * @evidence contracts/testing.md#behavioral-verification On Darwin descriptors are opened through 10500 and actual build-scoped transform succeeds before reset and descriptor close.
 * @evidence contracts/testing.md#independent-expectations Descriptor numbers and successful native result make spawn-capacity boundary observable; non-Darwin branch intentionally skips.
 * @evidence contracts/testing.md#distinguishing-cases High descriptor native host spawn/watch boundary, conditional macOS only.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_survives_high_darwin_descriptors is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Real macOS descriptor population surrounds runtime probes, producer build and native execution, exposing spawn/open failures unavailable through a direct portable unit call.
 * @evidence contracts/e2e.md#shared-execution One single-module project and build scope execute at the high descriptor boundary. Cached native artifacts may skip a cold Go rebuild; success does not certify a cold artifact compilation under the descriptor threshold.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Darwin-only descriptor handles belong to this case; cache reset and reverse descriptor closure run in finally. Non-Darwin returns before preparing artifacts; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: On Darwin descriptors are opened through 10500 and actual build-scoped transform succeeds before reset and descriptor close. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
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
