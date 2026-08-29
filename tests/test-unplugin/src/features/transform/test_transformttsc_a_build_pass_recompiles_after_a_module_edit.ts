import { assertAPassRecompilesAfterAModuleEdit } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass that edits a delivered module recompiles exactly once.
 *
 * The negative twin of the reuse case: retention must not outlive the state the
 * generation was proven against. A module's own bytes are the one input the
 * bundler itself supplies, so the source comparison catches them before any
 * proof runs, and the pass after the edit must then reuse the replacement
 * rather than compile a third time.
 *
 * 1. Deliver every module inside one pass, then append to one module's source.
 * 2. Open a second pass and deliver every module.
 * 3. Assert two compiles, then a third pass that changes nothing adds none.
 */
export const test_transformttsc_a_build_pass_recompiles_after_a_module_edit =
  async () => {
    await assertAPassRecompilesAfterAModuleEdit();
  };
