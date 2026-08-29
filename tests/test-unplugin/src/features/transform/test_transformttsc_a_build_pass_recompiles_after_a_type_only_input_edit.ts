import { assertAPassRecompilesAfterATypeOnlyInputEdit } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass recompiles for a type-only input the bundler never delivers.
 *
 * The input class the reference graph exists for. A bundler erases a type-only
 * edge from its own module graph, so nothing but the generation's recorded
 * snapshot can notice the edit; a retained generation that missed it would
 * serve generated code compiled against the previous type. This is the case
 * that bounds how far retention may go.
 *
 * 1. Deliver every module inside one pass.
 * 2. Edit a sibling reached only through the envelope's graph edges.
 * 3. Open a second pass, deliver one unrelated module, assert a second compile.
 */
export const test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit =
  async () => {
    await assertAPassRecompilesAfterATypeOnlyInputEdit();
  };
