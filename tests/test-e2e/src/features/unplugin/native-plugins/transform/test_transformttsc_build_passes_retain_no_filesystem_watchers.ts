import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies build-scoped caches retain no native filesystem watchers between
 * deliveries.
 *
 * A pass revalidates at its own boundary, so a watcher kept past the compile
 * would cost descriptors for nothing and outlive the build. Each compile still
 * needs one bounded watcher as its A-B-A witness, which has to close before
 * delivery.
 *
 * 1. Run a pass that delivers every module through a cache that counts opened and
 *    closed watchers.
 * 2. Edit a module and run a second pass over every module.
 * 3. Assert two witnesses were opened and all closed, the edit recompiled, and
 *    teardown leaves no watcher open.
 *
 * @evidence contracts/testing.md#behavioral-verification Two build passes over four modules, with a real source append in the second, must open exactly two temporary witness watchers, close all before delivery completes and count two native captures. Teardown must retain no open watcher.
 * @evidence contracts/testing.md#independent-expectations A build pass revalidates at its own boundary, so persistent watchers are unnecessary; each actual capture still needs its race witness. Independent open/close counters and native run-log bytes jointly require bounded lifetime without skipping source invalidation. The watcher seam does not test actual OS descriptor release.
 * @evidence contracts/testing.md#distinguishing-cases Initial capture and changed-source replacement each own one witness, while sibling cache hits must allocate none. Equality before and after reset distinguishes timely closure from cleanup only at teardown.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_build_passes_retain_no_filesystem_watchers owns two build passes sharing one native fixture/cache with explicit witness open/close counters. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared sidecar artifact serve both passes through one cache. The watch seam counts only bounded capture lifetimes and every sibling reuses its pass generation; an edited source is the sole required second capture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique fixture/log isolate the two passes, and local counters preserve all opens/closes across them. finally resets the cache even on failure and the final assertion verifies reset does not leave a handle; TestProject owns temporary roots.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_build_passes_retain_no_filesystem_watchers; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_build_passes_retain_no_filesystem_watchers(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 1 });
  let opened = 0;
  let closed = 0;
  const cache = api.createTtscTransformCache({
    watch: () => {
      opened += 1;
      return { close: () => (closed += 1) };
    },
  });
  const options = api.resolveOptions();
  const modules = projectModules(project.root);
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: () => undefined },
    );
  try {
    api.beginTtscTransformBuild(cache);
    for (const file of modules) assert.ok(await deliver(file));
    api.beginTtscTransformBuild(cache);
    fs.appendFileSync(modules[0]!, "\nexport const changed = 1;\n", "utf8");
    for (const file of modules) assert.ok(await deliver(file));
    assert.equal(
      opened,
      2,
      "each native compile must open one bounded A-B-A witness",
    );
    assert.equal(
      closed,
      opened,
      "a build-scoped generation must close its witness before delivery",
    );
    assert.equal(
      fs.readFileSync(project.runLog, "utf8").length,
      2,
      "the watcher-free pass must still recompile after an input edit",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
  assert.equal(closed, opened, "teardown must retain no build-scoped watcher");
}
