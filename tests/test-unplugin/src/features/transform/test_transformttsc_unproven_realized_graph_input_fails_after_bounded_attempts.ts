import { assertUnprovenRealizedInputFailsAfterBoundedAttempts } from "../../internal/transform-project-cache";

/**
 * Verifies an unproven realized graph input fails one bounded generation.
 *
 * A realized edge is compiler input, so its missing proof must never authorize
 * reuse. Letting every module discover that refusal independently multiplies a
 * whole-project compile by module count; the shared generation instead retries
 * once and reports the exact producer/input failure to every waiter.
 *
 * 1. Drop one realized edge target's compiler proof.
 * 2. Request four modules concurrently through one persistent cache.
 * 3. Assert two compiles and one shared path-specific terminal error.
 */
export const test_transformttsc_unproven_realized_graph_input_fails_after_bounded_attempts =
  async () => {
    await assertUnprovenRealizedInputFailsAfterBoundedAttempts();
  };
