import { assertRepeatedPassesReuseOneGeneration } from "../../internal/transform-delivery-epoch";

/**
 * Verifies repeated delivery passes over an unchanged project compile once.
 *
 * The samchon/ttsc#1300 defect in one measurement. A pass boundary states that
 * each module is requested at most once inside it; it says nothing about
 * whether the compiled program is still correct, which the generation's own
 * recorded snapshot answers. Asserting the first fact by destroying the
 * generation cost a whole-project transform on every rebuild of every watching
 * host, so this is the case that has to fail against the pre-fix adapter.
 *
 * 1. Deliver every module of a graph-bearing project inside one pass.
 * 2. Open two more passes and deliver every module again, changing nothing.
 * 3. Assert the fixture plugin ran exactly one whole-project compile.
 */
export const test_transformttsc_repeated_build_passes_reuse_one_generation =
  async () => {
    await assertRepeatedPassesReuseOneGeneration();
  };
