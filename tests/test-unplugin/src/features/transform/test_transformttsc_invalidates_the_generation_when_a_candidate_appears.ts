import { assertAppearingCandidateInvalidatesGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies an appearing resolution candidate still replaces the generation.
 *
 * The negative twin of the candidate relaxation: a candidate carries the
 * `missing` state the envelope recorded, which is state rather than the absence
 * of it, so creating the higher-priority spelling changes what the compiler
 * would resolve and must recompile.
 *
 * 1. Deliver one module from a generation that recorded missing candidates.
 * 2. Create the first candidate on disk.
 * 3. Deliver a sibling and assert a second compile.
 */
export const test_transformttsc_invalidates_the_generation_when_a_candidate_appears =
  async () => {
    await assertAppearingCandidateInvalidatesGeneration();
  };
