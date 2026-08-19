import { assertRetargetedCandidateLinkInvalidatesGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies retargeting a link a candidate is reached through invalidates the
 * generation.
 *
 * The boundary samchon/ttsc#1261's notification proof stands or falls on. A
 * watcher opened on a spelling that traverses a link follows it, so the link's
 * retarget moves the answer while the watch keeps looking at the old target,
 * which is the pnpm store layout exactly.
 *
 * 1. Point an unused candidate directory at an empty target through a junction.
 * 2. Deliver one module to capture the generation.
 * 3. Retarget the junction at a directory carrying the candidate and assert the
 *    next delivery recompiled.
 */
export const test_transformttsc_retargeted_candidate_link_invalidates_generation =
  async () => {
    await assertRetargetedCandidateLinkInvalidatesGeneration();
  };
