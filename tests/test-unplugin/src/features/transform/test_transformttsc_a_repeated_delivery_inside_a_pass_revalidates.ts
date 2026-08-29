import { assertARepeatedDeliveryInsideAPassRevalidates } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a module delivered twice inside one pass revalidates the second time.
 *
 * The constant-time shortcut is a statement about a module's *first* delivery in
 * a pass. A bundler asking for the same module again is the one signal the pass
 * itself provides that something may have moved, so the retained generation must
 * not silently answer it from the pass gate.
 *
 * 1. Open a pass and deliver one module.
 * 2. Change a universal host input, then deliver the same module again.
 * 3. Assert the second delivery replaced the generation.
 */
export const test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates =
  async () => {
    await assertARepeatedDeliveryInsideAPassRevalidates();
  };
