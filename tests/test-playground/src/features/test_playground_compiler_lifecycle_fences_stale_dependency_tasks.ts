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
  };
