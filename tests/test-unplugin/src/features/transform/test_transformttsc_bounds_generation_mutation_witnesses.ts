import { assertGenerationMutationWitnessesStayBounded } from "../../internal/transform-project-cache";

/**
 * Verifies generation mutation witnesses remain bounded.
 *
 * One watch event already proves a generation stale, so retaining every later
 * unique event path would turn a long-lived development server into an
 * unbounded memory sink without improving its verdict.
 *
 * 1. Publish one stable cached generation with synthetic project watchers.
 * 2. Send 32 distinct rename events through every registered listener.
 * 3. Assert the tracker retains eight paths and one omission flag.
 */
export async function test_transformttsc_bounds_generation_mutation_witnesses(): Promise<void> {
  await assertGenerationMutationWitnessesStayBounded();
}
