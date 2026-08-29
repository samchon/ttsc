import { assertAFailedCompileCostsOneCompilePerPass } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a failed compile costs one compile per pass, not one per module.
 *
 * The samchon/ttsc#1303 defect, on the real native host because only a linked
 * contributor shares the compiler's program and therefore sees its diagnostics.
 * A pass settles every delivery against the state it started from, so an
 * attempt the pass already made is part of that state; evicting it instead made
 * each remaining module repeat the whole-project transform to reach the
 * identical answer.
 *
 * 1. Plant a type error and open one delivery pass.
 * 2. Deliver every sibling module, expecting each to reject with TS2322.
 * 3. Assert the cache holds the very same generation object throughout.
 */
export const test_real_native_envelope_failed_compile_costs_one_compile_per_pass =
  async () => {
    await assertAFailedCompileCostsOneCompilePerPass();
  };
