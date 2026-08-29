import { assertRollupDisposesAtTheRightBoundary } from "../../internal/adapter-rollup";

/**
 * Verifies the Rollup adapter disposes its generation at the right boundary.
 *
 * The Rollup and Rolldown blocks carry both halves of the rule the Vite block
 * does, and the gate between them is load-bearing: `buildEnd` disposes only for
 * a one-shot build, because Rollup's watcher repeats a build phase and
 * disposing on that repeat is samchon/ttsc#1301. Nothing exercised either half
 * before, including `this.meta.watchMode` itself.
 *
 * 1. Deliver under a watching build phase and assert the rebuild reuses.
 * 2. Invoke `closeWatcher` and assert the next session compiles again.
 * 3. Invoke `buildEnd` with `watchMode: false` and assert it disposes too.
 */
export const test_rollup_disposes_at_the_right_boundary = async () => {
  await assertRollupDisposesAtTheRightBoundary();
};
