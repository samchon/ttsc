import assert from "node:assert/strict";

import { PlaygroundCompilerLifecycle } from "../../../../packages/playground/lib/src/react/internal/PlaygroundCompilerLifecycle.js";

/**
 * Verifies Worker generation invalidation fences active and queued mutations.
 *
 * A terminal boot failure can arrive while one dependency task is active and
 * another is queued. The active task may finish its external work, but it must
 * not publish into the replacement generation; the queued old-generation task
 * must never start. An old token also cannot invalidate the replacement.
 */
export const test_playground_compiler_lifecycle_fences_stale_dependency_tasks =
  async (): Promise<void> => {
    const lifecycle = new PlaygroundCompilerLifecycle();
    const oldGeneration = lifecycle.capture();
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted = false;
    let firstCommitted = false;
    let secondStarted = false;

    const first = lifecycle.enqueue(async (generation) => {
      firstStarted = true;
      await firstBlocked;
      if (generation.isCurrent()) firstCommitted = true;
    });
    const second = lifecycle.enqueue(async () => {
      secondStarted = true;
    });

    await Promise.resolve();
    assert.equal(firstStarted, true);

    const replacement = lifecycle.invalidateIfCurrent(oldGeneration);
    assert.ok(replacement);
    assert.equal(
      lifecycle.invalidateIfCurrent(oldGeneration),
      undefined,
      "an obsolete failure cannot fence the replacement generation",
    );

    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(firstCommitted, false);
    assert.equal(secondStarted, false);
    assert.equal(replacement.isCurrent(), true);

    let replacementCommitted = false;
    await lifecycle.enqueue(async (generation) => {
      assert.equal(generation.isCurrent(), true);
      replacementCommitted = true;
    });
    assert.equal(replacementCommitted, true);

    let sourceVersion = 0;
    let dependencyMetadata = "installed:A";
    let releaseReset!: () => void;
    let resetStarted!: () => void;
    const resetDidStart = new Promise<void>((resolve) => {
      resetStarted = resolve;
    });
    const resetBlocked = new Promise<void>((resolve) => {
      releaseReset = resolve;
    });
    const reset = lifecycle.resetWorkerIfCurrent(
      replacement,
      async () => {
        resetStarted();
        await resetBlocked;
      },
      () => {
        dependencyMetadata = "";
      },
    );
    await resetDidStart;
    sourceVersion++;
    releaseReset();
    assert.equal(await reset, true);
    assert.equal(sourceVersion, 1);
    assert.equal(
      dependencyMetadata,
      "",
      "a source change during reset cannot preserve the old Worker's metadata",
    );

    const beforeClientReplacement = lifecycle.capture();
    dependencyMetadata = "replacement-worker";
    let releaseStaleReset!: () => void;
    let staleResetStarted!: () => void;
    const staleResetDidStart = new Promise<void>((resolve) => {
      staleResetStarted = resolve;
    });
    const staleResetBlocked = new Promise<void>((resolve) => {
      releaseStaleReset = resolve;
    });
    const staleReset = lifecycle.resetWorkerIfCurrent(
      beforeClientReplacement,
      async () => {
        staleResetStarted();
        await staleResetBlocked;
      },
      () => {
        dependencyMetadata = "";
      },
    );
    await staleResetDidStart;
    lifecycle.invalidate();
    releaseStaleReset();
    assert.equal(await staleReset, false);
    assert.equal(
      dependencyMetadata,
      "replacement-worker",
      "a stale reset cannot clear replacement-generation metadata",
    );
  };
