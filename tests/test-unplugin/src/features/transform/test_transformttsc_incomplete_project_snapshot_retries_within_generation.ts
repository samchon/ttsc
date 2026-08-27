import { assertIncompleteProjectSnapshotRetriesWithinGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies one incomplete project snapshot retries inside its generation.
 *
 * A transient directory read can make the first pre/post walk unprovable. The
 * cache Promise owns one stabilization retry, so no partial output reaches a
 * module and later siblings do not each recompile the whole project.
 *
 * 1. Fail one nested-directory read after the first compile.
 * 2. Let the shared generation retry against the settled tree.
 * 3. Assert two compiles and reuse of only the complete second attempt.
 */
export const test_transformttsc_incomplete_project_snapshot_retries_within_generation =
  async () => {
    await assertIncompleteProjectSnapshotRetriesWithinGeneration();
  };
