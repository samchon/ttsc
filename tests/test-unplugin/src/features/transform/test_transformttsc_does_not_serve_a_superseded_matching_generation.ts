import { assertSupersededMatchingGenerationIsNotServed } from "../../internal/transform-project-cache";

/**
 * Verifies a matching waiter cannot return a superseded cache generation.
 *
 * Two callers can resume from one old Promise. One observes a source mismatch
 * and installs a new generation; the other source still matches the old
 * snapshot. The latter must re-check cache identity before selecting output.
 *
 * 1. Start mismatching and matching callers on a deferred stale generation.
 * 2. Resolve it with an observable stale output marker.
 * 3. Assert neither caller returns that superseded output.
 */
export const test_transformttsc_does_not_serve_a_superseded_matching_generation =
  async () => {
    await assertSupersededMatchingGenerationIsNotServed();
  };
