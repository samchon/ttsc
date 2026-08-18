import { assertSameTickRewriteReplacesTheSnapshotGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies the whole-snapshot path sees same-tick rewrites on both the project
 * walk and the out-of-walk re-check.
 *
 * Pins samchon/ttsc#1227 on the fallback that validates a generation whose
 * watchers could not be opened. The walk reuses a recorded hash for a file
 * whose proven signature still holds, and the out-of-walk re-check does the
 * same for external inputs; a signature recorded inside an unfinished tick made
 * a same-length rewrite invisible to both before the fix.
 *
 * 1. Deliver a project with every watch registration refused and every stamp
 *    pinned to one tick, so validation runs the whole-snapshot path.
 * 2. Rewrite one project file with same-length bytes and deliver a sibling, so
 *    only the walk can see the edit; assert one recompile.
 * 3. Rewrite one external declaration the same way; assert another recompile.
 */
export const test_transformttsc_same_tick_rewrite_replaces_the_snapshot_generation =
  async () => {
    await assertSameTickRewriteReplacesTheSnapshotGeneration();
  };
