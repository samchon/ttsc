import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";

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
