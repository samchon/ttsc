import { assertOutOfProjectCandidateIsStillProbed } from "../../internal/transform-project-cache";

/**
 * Verifies a candidate outside the project subtree keeps its filesystem check.
 *
 * The boundary the absent-candidate watch of samchon/ttsc#1261 declines at. Its
 * chain stops at the project's own root, so a spelling that leaves the subtree
 * before reaching it cannot be covered — a link along the outside part would
 * move the answer with nothing inside the bound to report it — and the delivery
 * must go on asking the filesystem instead of trusting a proof that was never
 * completed.
 *
 * 1. Stamp one candidate at an absolute spelling outside the project root.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert that spelling was checked.
 */
export const test_transformttsc_out_of_project_candidate_is_still_probed =
  async () => {
    await assertOutOfProjectCandidateIsStillProbed();
  };
