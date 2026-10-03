import assert from "node:assert/strict";

import { startViteBuildSession } from "./internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Shares the unchanged watch-build generation with its teardown contrast.
 *
 * @evidence contracts/testing.md#behavioral-verification Three unchanged passes successfully deliver all four modules with compile count1. The first delivery also asserts count1; closeWatcher followed by a new pass and successful first-module delivery requires count2.
 * @evidence contracts/testing.md#independent-expectations Original literal native run-log counts1/2 distinguish generation retention from replacement despite identical source output.
 * @evidence contracts/testing.md#distinguishing-cases Repeated buildStart/buildEnd retains the generation; closeWatcher disposes it and the next pass reconstructs it.
 * @evidence contracts/testing.md#execution-ownership The shared Unplugin experiment invokes this survivor. Both original watch-build donors remain in the legacy population; this authored body is unexecuted.
 * @evidence contracts/e2e.md#necessary-boundary Actual built Vite hooks connect the native fixture transform to watch-build retention and disposal. Hook driving does not certify a running Rollup watcher or arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#shared-execution One original four-module project, descriptor, run log, loaded adapter and unchanged generation serve the three rebuild passes and close/reconstruction contrast, replacing two independent identical fixture preparations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity No source or configuration changes between phases. Failed assertions are collected while successful hook returns permit teardown contrast; a thrown delivery or pass blocks dependent reconstruction. Finally awaits the original closeWatcher owner on every outcome.
 * @evidence contracts/e2e.md#preserved-coverage Preserves test_vite_build_watch_reuses_the_generation_across_rebuilds all twelve successful deliveries and count1, plus test_vite_build_watch_disposes_the_generation_on_close_watcher first delivery/count1, endPass, close, startPass, successful replacement/count2 and final close. Actual selected coverage and donor removal remain pending.
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
        await session.close();
        await session.startPass();
        assert.ok(await session.deliver(session.modules[0]!));
        assert.equal(
          session.projectCompiles(), 2,
          "closeWatcher must dispose the generation, so the next session compiles again",
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
