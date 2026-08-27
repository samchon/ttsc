import { assertPersistentIncompleteProjectSnapshotFailsAfterBoundedAttempts } from "../../internal/transform-project-cache";

/**
 * Verifies a persistently incomplete project snapshot terminates with evidence.
 *
 * Retrying without a bound can turn a permission or filesystem failure into an
 * infinite build. Publishing either partial attempt is unsound, so the shared
 * generation rejects after two compiles with the unreadable directory path.
 *
 * 1. Keep one nested directory unreadable after compilation begins.
 * 2. Request a transform through one persistent cache.
 * 3. Assert two attempts, an exact witness, eviction, and later recovery.
 */
export const test_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts =
  async () => {
    await assertPersistentIncompleteProjectSnapshotFailsAfterBoundedAttempts();
  };
