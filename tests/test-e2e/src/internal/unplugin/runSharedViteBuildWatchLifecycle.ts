import assert from "node:assert/strict";

import { startViteBuildSession } from "./internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Shares the unchanged watch-build generation with its teardown contrast.
 *
 * @evidence contracts/testing.md#behavioral-verification Three unchanged passes successfully deliver all four modules with compile count1. closeWatcher and replacement require count2. Closing that replacement mid-pass then ending it late permits ordinary builds: original mid-pass interval counts1/2/3 and ordinary environment interval counts1/2 remain independently asserted.
 * @evidence contracts/testing.md#independent-expectations Original literal native run-log counts1/2 distinguish generation retention from replacement despite identical source output.
 * @evidence contracts/testing.md#distinguishing-cases Repeated buildStart/buildEnd retains the generation; closeWatcher disposes it. Mid-pass close followed by late end must not strand the owner count; immediate ordinary environments retain the generation, whereas a 2500ms consumer gap releases it.
 * @evidence contracts/testing.md#execution-ownership The shared Unplugin experiment invokes this survivor. Both original watch-build donors remain in the legacy population; this authored body is unexecuted.
 * @evidence contracts/e2e.md#necessary-boundary Actual built Vite hooks connect the native fixture transform to watch-build retention and disposal. Hook driving does not certify a running Rollup watcher or arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#shared-execution One original four-module project, descriptor, run log and loaded adapter serve unchanged watch passes, close/reconstruction, mid-pass interruption and ordinary environment release. One unchanged native generation and one original 2500ms grace serve both ordinary-release and interrupted-owner contrasts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity No source or configuration changes between phases. Failed assertions are collected while successful hook returns permit teardown contrast; a thrown delivery or pass blocks dependent reconstruction. Finally awaits the original closeWatcher owner on every outcome.
 * @evidence contracts/e2e.md#preserved-coverage Preserves both watch-build donors all twelve deliveries/count1, initial-first/count1 and replacement/count2. Also preserves test_vite_close_watcher_mid_pass_keeps_the_counter_sound close-before-end/config-switch/successful deliveries/interval1/2/3 and test_vite_build_releases_the_generation_after_its_last_environment immediate first/second-module deliveries/interval1 then grace/replacement/interval2. Interval baselines are actual prior run-log counts, never resets or predicted process totals. Final close remains; remote coverage and donor removal are pending.
 */
export async function runSharedViteBuildWatchLifecycle(): Promise<void> {
  const session = await startViteBuildSession(true);
  const failures: unknown[] = [];
  let passesReturned = false;
  try {
    try {
      for (let rebuild = 0; rebuild < 3; rebuild += 1) {
        await session.startPass();
        for (const file of session.modules) {
          const delivered = await session.deliver(file);
          try {
            assert.ok(delivered);
            if (rebuild === 0 && file === session.modules[0])
              assert.equal(session.projectCompiles(), 1);
          } catch (cause) {
            failures.push(new Error(`watch build delivery ${rebuild}:${file}`, { cause }));
          }
        }
        await session.endPass();
      }
      passesReturned = true;
      assert.equal(
        session.projectCompiles(), 1,
        "every rebuild that changed no compiler input must reuse the one generation",
      );
    } catch (cause) {
      failures.push(new Error("unchanged watch rebuild generation", { cause }));
    }
    if (passesReturned) {
      try {
        const interruptionBaseline = session.projectCompiles();
        await session.close();
        await session.startPass();
        assert.ok(await session.deliver(session.modules[0]!));
        assert.equal(
          session.projectCompiles(), 2,
          "closeWatcher must dispose the generation, so the next session compiles again",
        );
        assert.equal(session.projectCompiles() - interruptionBaseline, 1);
        // This replacement pass is still open, exactly the interrupted donor's
        // initial state. Its late end must not consume a new owner's count.
        await session.close();
        await session.endPass();
        const environmentBaseline = session.projectCompiles();
        session.resolveAs(false);
        await session.startPass();
        assert.ok(await session.deliver(session.modules[0]!));
        assert.equal(session.projectCompiles() - interruptionBaseline, 2);
        await session.endPass();
        await session.startPass();
        assert.ok(await session.deliver(session.modules[1]!));
        assert.equal(
          session.projectCompiles() - environmentBaseline, 1,
          "the next environment's build reuses the proven generation",
        );
        await session.endPass();
        await new Promise((resolve) => setTimeout(resolve, 2_500));
        await session.startPass();
        assert.ok(await session.deliver(session.modules[0]!));
        assert.equal(
          session.projectCompiles() - interruptionBaseline, 3,
          "a mid-pass teardown must leave the container counter able to reach zero again",
        );
        assert.equal(
          session.projectCompiles() - environmentBaseline, 2,
          "a generation no build takes up within the grace is released",
        );
      } catch (cause) {
        failures.push(new Error("watch close and replacement generation", { cause }));
      }
    } else {
      failures.push(new Error("watch replacement blocked: a delivery or pass did not return"));
    }
  } finally {
    try {
      await session.close();
    } catch (cause) {
      failures.push(new Error("final watch lifecycle close", { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "shared Vite watch build lifecycle");
}
