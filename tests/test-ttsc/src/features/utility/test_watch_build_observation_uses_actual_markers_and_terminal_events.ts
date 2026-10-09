import assert from "node:assert/strict";

import { WatchBuildObservation } from "../../../../utils/src/WatchBuildObservation";

/**
 * Verifies watch observations follow actual markers, terminal events and silence.
 *
 * The same portable observer used by WatchSession consumes authored chunks;
 * direct calls distinguish stream splits and queued cycles without a process.
 *
 * 1. Split completion and failure markers across chunks and await actual cycles.
 * 2. Contrast delivered-before-close with unmet observations at error or close.
 * 3. Keep a queued cycle pending, then complete it and observe finite silence.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual WatchSession observation owner with chunks, original Error objects and close callbacks. Assertions distinguish starts from completed/failed cycles and reject activity during finite quiet windows.
 * @evidence contracts/testing.md#independent-expectations Literal launcher marker grammar fixes cycle counts; authored original errors must remain rejection causes. A start cannot stand for completion, and a failed build still terminates its cycle.
 * @evidence contracts/testing.md#distinguishing-cases Empty, partial, completed and failed markers contrast with unrelated output. Delivered-before-close differs from an unmet marker at close; process and stream errors retain identity. Quiet start/completion/error/close fail, silence succeeds, and queued starts require all corresponding completions before settling.
 * @evidence contracts/testing.md#execution-ownership The normal test-ttsc feature runner discovers this direct portable unit. It imports the shared owner used by WatchSession and invokes only callbacks and timers, without a host, process, compiler, installer or producer.
 */
export async function test_watch_build_observation_uses_actual_markers_and_terminal_events(): Promise<void> {
  const watch = new WatchBuildObservation("authored watch");
  assert.equal(watch.completed(), 0);
  let completed = false;
  const first = watch.waitForBuilds(1).then(() => { completed = true; });
  watch.append("[ttsc] rebuilding at first\nnoise watch build complete\n[ttsc] watch bu", "stdout");
  watch.append("ild complete\n", "stderr");
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(watch.completed(), 0);
  watch.append("ild complete\n[ttsc] rebuilding at second\n[ttsc] watch build fai", "stdout");
  await first;
  assert.equal(watch.completed(), 1);
  watch.append("led\n", "stdout");
  await watch.waitForBuilds(2);
  assert.equal(watch.completed(), 2);
  assert.match(watch.transcript(), /noise watch build complete/);
  watch.close();
  await watch.waitForBuilds(2);
  await assert.rejects(watch.waitForBuilds(3), /did not reach 3 builds/);

  const failed = new WatchBuildObservation("failed watch");
  const original = new Error("original stream error");
  const missing = failed.waitForBuilds(1);
  failed.fail(original);
  await assert.rejects(missing, (error: Error) => error.cause === original);
  await assert.rejects(failed.waitForSettled(0), (error: Error) => error.cause === original);
  await assert.rejects(failed.waitForQuiet(0), (error: Error) => error === original);

  const pending = new WatchBuildObservation("queued watch");
  pending.append("[ttsc] rebuilding at first\n", "stderr");
  let settled = false;
  const settlement = pending.waitForSettled(0).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  pending.append("[ttsc] watch build complete\n[ttsc] rebuilding at queued\n", "stderr");
  await Promise.resolve();
  assert.equal(settled, false);
  pending.append("[ttsc] watch build failed\n", "stderr");
  await settlement;
  await pending.waitForSettled(1);
  await pending.waitForQuiet(1);

  for (const transition of ["start", "complete", "error", "close"] as const) {
    const observed = new WatchBuildObservation(transition);
    const quiet = observed.waitForQuiet(10_000);
    if (transition === "start") observed.append("[ttsc] rebuilding at next\n", "stdout");
    else if (transition === "complete") observed.append("[ttsc] watch build complete\n", "stderr");
    else if (transition === "error") observed.fail(original);
    else observed.close();
    await assert.rejects(quiet);
  }
  const closed = new WatchBuildObservation("closed watch");
  const uncompleted = closed.waitForBuilds(1);
  closed.close();
  await assert.rejects(uncompleted, /did not reach 1 builds/);
  await assert.rejects(closed.waitForSettled(0), /did not settle/);
  await assert.rejects(closed.waitForQuiet(0), /exited during observation/);
}
