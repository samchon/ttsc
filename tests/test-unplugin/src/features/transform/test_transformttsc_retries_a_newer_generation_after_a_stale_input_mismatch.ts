import { assertStaleMismatchUsesNewerGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies stale input validation cannot delete a newer cache generation.
 *
 * An old generation can finish after another caller has replaced its cache
 * slot. If the old snapshot then mismatches, unconditional deletion removes the
 * replacement and starts an unnecessary third compile.
 *
 * 1. Begin awaiting a deferred stale generation.
 * 2. Install a valid newer generation, then resolve the old one with a mismatch.
 * 3. Assert the request retries and retains the newer generation.
 */
export const test_transformttsc_retries_a_newer_generation_after_a_stale_input_mismatch =
  async () => {
    await assertStaleMismatchUsesNewerGeneration();
  };
