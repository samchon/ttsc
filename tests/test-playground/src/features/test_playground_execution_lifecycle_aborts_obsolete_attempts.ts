import assert from "node:assert/strict";

import { PlaygroundExecutionLifecycle } from "../../../../packages/playground/lib/src/react/internal/PlaygroundExecutionLifecycle.js";

/**
 * Verifies every Execute supersession path shares one abort and stale-write
 * boundary.
 *
 * The shell uses this lifecycle for source changes, option changes, a newer
 * Execute, and unmount. Testing the state machine directly proves that an old
 * callback cannot commit after any of those invalidations.
 *
 * 1. Start an attempt, then start another and observe the first abort.
 * 2. Invalidate the current attempt and reject all of its later writes.
 * 3. Finish a current attempt and leave its completed signal untouched.
 */
export const test_playground_execution_lifecycle_aborts_obsolete_attempts =
  (): void => {
    const lifecycle = new PlaygroundExecutionLifecycle();
    const first = lifecycle.begin();
    assert.equal(first.isCurrent(), true);

    const second = lifecycle.begin();
    assert.equal(first.signal.aborted, true);
    assert.equal(first.isCurrent(), false);
    assert.equal(second.isCurrent(), true);
    assert.equal(first.signal.reason?.name, "AbortError");
    assert.match(first.signal.reason?.message, /newer Execute started/);

    assert.equal(lifecycle.invalidate("source changed"), true);
    assert.equal(second.signal.aborted, true);
    assert.equal(second.isCurrent(), false);
    assert.equal(second.finish(), false);
    assert.match(second.signal.reason?.message, /source changed/);

    const completed = lifecycle.begin();
    assert.equal(completed.finish(), true);
    assert.equal(completed.isCurrent(), false);
    assert.equal(completed.signal.aborted, false);
    assert.equal(lifecycle.invalidate("playground unmounted"), false);
    assert.equal(completed.signal.aborted, false);
  };
