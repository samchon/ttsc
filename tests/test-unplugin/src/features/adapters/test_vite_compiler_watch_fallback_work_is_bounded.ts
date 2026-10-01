import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";

/**
 * Verifies a failed native watcher moves its inputs to a bounded fallback
 * instead of a full-graph scan.
 *
 * When a native observer fails, its inputs have to be checked by polling, and
 * on a large compiler graph a poll that inspected every input on every tick
 * would itself become the cost the watcher exists to avoid. The fallback must
 * share one scheduler, release the failed handle at once, and inspect a
 * fixed-size slice per tick.
 *
 * 1. Attach a watcher whose native observers fail on open, and register 65 inputs.
 * 2. Assert one shared scheduler starts and the failed watcher is released
 *    immediately.
 * 3. Drive ticks and assert each inspects one fair, fixed-size slice, and the
 *    scheduler stops when no work remains.
 * 4. Dispose and assert the detached watcher is not closed again.
 * @evidence contracts/testing.md#behavioral-verification
 *   Injects native watcher failure into createViteServeInputWatch; asserts immediate handle release, one scheduler, 64 then 65 invalidations and scheduler stop without a second close.
 * @evidence contracts/testing.md#independent-expectations
 *   The supported scheduler budget is 64 inputs per tick. A 65-input fixture independently distinguishes bounded fair progress from a full scan or a starved final input.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes native open failure, one input beyond the budget, exhausted work and final disposal; captures both callback count and handle-close count.
 * @evidence contracts/testing.md#execution-ownership
 *   test_vite_compiler_watch_fallback_work_is_bounded calls createViteServeInputWatch.attach/replace with a failing watch double, drives its captured poll twice, and disposes in finally; it owns the 65-input boundary without a Vite server or native observer.
 */
export async function test_vite_compiler_watch_fallback_work_is_bounded(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-fallback-budget-"),
  );
  const invalidated = new Set<string>();
  let poll: (() => void) | undefined;
  let failedWatcherCloses = 0;
  const watch = createViteServeInputWatch({
    poll(listener) {
      assert.equal(poll, undefined, "fallback must use one shared scheduler");
      poll = listener;
      return { close: () => (poll = undefined) };
    },
    watch(_scope, _listener, onError) {
      onError();
      return { close: () => (failedWatcherCloses += 1) };
    },
  });
  // One entry beyond the per-tick budget proves both the cap and eventual
  // progress without making this constant-cost scheduler test do extra work.
  const count = 65;
  const nodes = new Map<string, Set<{ file: string }>>();
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => nodes.get(file),
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    for (let index = 0; index < count; index += 1) {
      const file = path.join(root, `${index}.txt`);
      const importer = path.join(root, `${index}.ts`).replace(/\\/g, "/");
      fs.writeFileSync(file, "before");
      nodes.set(importer, new Set([{ file: importer }]));
      watch.replace(importer, [{ file }]);
      fs.writeFileSync(file, "after");
    }
    assert.ok(poll, "failed native observation must start the shared fallback");
    assert.equal(
      failedWatcherCloses,
      1,
      "fallback must release the failed native watcher immediately",
    );
    const tick = poll;
    for (const expected of [64, 65]) {
      tick();
      assert.equal(
        invalidated.size,
        expected,
        "each tick must inspect one fair, fixed-size slice of the graph",
      );
    }
    assert.equal(
      poll,
      undefined,
      "the scheduler must stop when no work remains",
    );
  } finally {
    await watch.dispose();
  }
  assert.equal(
    failedWatcherCloses,
    1,
    "disposal must not re-close the detached failed watcher",
  );
}
