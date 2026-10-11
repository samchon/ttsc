import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies the complete transform survives Darwin's high-descriptor spawn edge.
 *
 * On macOS, a process holding descriptors above a system threshold can fail to
 * spawn children or open watchers in ways a low-descriptor test never reaches.
 * Runtime probes, descriptor evaluation, the Go build, and the native execution
 * all spawn or open files, so each must survive it.
 *
 * 1. Skip unless the host is macOS.
 * 2. Open descriptors until the last one opened is at least 10,500. Where the
 *    kernel caps one process at or below libuv's 10,240 threshold
 *    (`kern.maxfilesperproc`), no descriptor can exceed it; report the skip.
 * 3. Run a build-scoped transform and assert it succeeds, then close every
 *    descriptor.
 *
 * @evidence contracts/testing.md#behavioral-verification On Darwin descriptors are opened through 10500 and actual build-scoped transform succeeds before reset and descriptor close.
 * @evidence contracts/testing.md#independent-expectations Descriptor numbers and successful native result make spawn-capacity boundary observable; non-Darwin branch intentionally skips.
 * @evidence contracts/testing.md#distinguishing-cases High descriptor native host spawn/watch boundary, conditional macOS only.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_survives_high_darwin_descriptors owns the Darwin-only high-descriptor native transform and its cache/descriptor cleanup. Evidence selection does not establish runtime coverage.
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
  // The kernel's own cap on one process's descriptors. Where it stops below the
  // libuv threshold, no descriptor can exist above it, so the failure this case
  // guards cannot arise on the host and the case is reported as skipped.
  const kernelCap = Number(
    E2eProcessTrace.spawnSync(
      "/usr/sbin/sysctl",
      ["-n", "kern.maxfilesperproc"],
      {
        encoding: "utf8",
      },
    ).stdout.trim(),
  );
  try {
    while ((descriptors.at(-1) ?? -1) < 10_500) {
      try {
        descriptors.push(fs.openSync("/dev/null", "r"));
      } catch (error) {
        const reached = (descriptors.at(-1) ?? -1) + 1;
        if (
          (error as NodeJS.ErrnoException).code === "EMFILE" &&
          Number.isSafeInteger(kernelCap) &&
          kernelCap <= 10_240 &&
          reached >= kernelCap - 1
        ) {
          console.log(
            `CAPABILITY-SKIPPED:high-darwin-descriptors kern.maxfilesperproc=${kernelCap} keeps every descriptor below the libuv threshold 10240`,
          );
          return;
        }
        throw new Error(
          `descriptor ${reached} could not be opened after this case opened ${descriptors.length}; kern.maxfilesperproc: ${kernelCap}`,
          { cause: error },
        );
      }
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
