import { assertRecreatedCandidateDirectoryInvalidatesGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies replacing a candidate's directory invalidates the generation.
 *
 * The second half of what the chain watch in samchon/ttsc#1261 exists for: a
 * package manager removes `node_modules/<package>` and lays a new tree in its
 * place. The watch the candidate opened dies with the directory it was opened
 * on and reports nothing, so only the name being watched in the parent says
 * that anything happened.
 *
 * 1. Create the candidate's directory empty and deliver one module.
 * 2. Remove that directory and recreate it with the candidate inside.
 * 3. Assert the next delivery recompiled.
 */
export const test_transformttsc_recreated_candidate_directory_invalidates_generation =
  async () => {
    await assertRecreatedCandidateDirectoryInvalidatesGeneration();
  };
