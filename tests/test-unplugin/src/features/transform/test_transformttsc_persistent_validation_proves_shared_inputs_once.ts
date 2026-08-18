import { assertPersistentValidationProvesSharedInputsOnce } from "../../internal/transform-project-cache";

/**
 * Verifies a generation proves each shared derived input once, not per module.
 *
 * Pins samchon/ttsc#1222. Real programs give every module the same reachable
 * closure and the same `graph.globals`, so a persistent host that re-read each
 * delivered file's inputs multiplied one generation's proven bytes by the module
 * count; the partitioned fixture used by the neighbouring per-file-inputs test
 * cannot observe that. An unchanged metadata signature must stand in for the
 * content comparison without loosening any invalidation.
 *
 * 1. Replay a shared graph closure with global-scope declarations and assert
 *    per-module reads stay bounded.
 * 2. Touch one global: the generation survives, the content comparison runs
 *    once, and later deliveries stop re-reading it.
 * 3. Edit a global, a reachable external, project membership, and a reachable
 *    project source, and assert each replaces the generation.
 */
export const test_transformttsc_persistent_validation_proves_shared_inputs_once =
  async () => {
    await assertPersistentValidationProvesSharedInputsOnce();
  };
