import { assertRealEnvelopeDeclarationChangeReplacesGeneration } from "../../internal/real-native-envelope";

/**
 * Verifies a selected declaration edit replaces the persistent generation.
 *
 * The positive cache gate is sound only if realized compiler proofs retain
 * their opposite verdict from speculative unproven candidates. A changed
 * declaration reached by every importer must invalidate once, then be reused.
 *
 * 1. Deliver one importer and prove the selected declaration's native proofs.
 * 2. Change that declaration before delivering a sibling importer.
 * 3. Require one replacement compile and reuse it for every remaining sibling.
 */
export const test_real_native_envelope_declaration_change_replaces_generation =
  async () => {
    await assertRealEnvelopeDeclarationChangeReplacesGeneration();
  };
