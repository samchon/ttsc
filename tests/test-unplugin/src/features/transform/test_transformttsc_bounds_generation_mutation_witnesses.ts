import { assertGenerationMutationWitnessesStayBounded } from "../../internal/transform-project-cache";

/**
 * Verifies a long-lived generation does not retain an unbounded watch-event
 * stream after the first event has already proved that generation stale.
 */
export async function test_transformttsc_bounds_generation_mutation_witnesses(): Promise<void> {
  await assertGenerationMutationWitnessesStayBounded();
}
