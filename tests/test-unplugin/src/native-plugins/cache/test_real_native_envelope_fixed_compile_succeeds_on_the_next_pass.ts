import { assertAFixedCompileSucceedsOnTheNextPass } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a corrected project transforms again on the next pass.
 *
 * The property the per-delivery eviction was protecting: retention must never
 * become a dead end. Recovery has to arrive at the pass boundary rather than
 * through a special case, and the corrected delivery must produce real output
 * rather than merely a different verdict.
 *
 * 1. Plant a type error, open a pass, and deliver a module.
 * 2. Correct the error on disk and open a second pass.
 * 3. Assert the delivery succeeds.
 */
export const test_real_native_envelope_fixed_compile_succeeds_on_the_next_pass =
  async () => {
    await assertAFixedCompileSucceedsOnTheNextPass();
  };
