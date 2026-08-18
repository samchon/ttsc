import { assertRecentlyModifiedInputRecoversItsProof } from "../../internal/transform-project-cache";

/**
 * Verifies a too-recent modification time earns no proof, and later recovers
 * one.
 *
 * A filesystem stamps a write once per clock tick, so an input modified inside
 * the tick its signature was captured in can be rewritten to a different
 * payload of the same length without moving that signature. The capture cutoff
 * therefore sits behind any such tick, and a freshly modified input keeps its
 * content comparison. It must also stop paying for that once its timestamp is
 * old enough: nothing else revisits an input, so a delivery that first sees a
 * file mid-edit would otherwise condemn it to a re-read for the generation's
 * life.
 *
 * 1. Deliver an aged project and confirm a reachable declaration is proven by its
 *    signature alone.
 * 2. Stamp that declaration with the current time and assert the next two
 *    deliveries both read it.
 * 3. Age the stamp and assert the delivery after the revalidation stops.
 */
export const test_transformttsc_recently_modified_input_recovers_its_proof =
  async () => {
    await assertRecentlyModifiedInputRecoversItsProof();
  };
