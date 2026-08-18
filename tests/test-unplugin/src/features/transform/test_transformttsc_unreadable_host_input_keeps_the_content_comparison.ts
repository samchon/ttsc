import { assertUnreadableHostInputKeepsTheContentComparison } from "../../internal/transform-project-cache";

/**
 * Verifies a universal host input with no readable content never earns a proof.
 *
 * Descriptor and config inputs are validated through their own manifest, which
 * skips an entry whose metadata still matches. An input the host could see but
 * not read records no content hash on either side, so its missing state matches
 * while it stays unreadable and its metadata never moves. A signature for it
 * would be skipped for the generation's life, and the per-module loop skips the
 * same path, so bytes appearing later would never be compared at all.
 *
 * 1. Declare one out-of-walk host input the descriptor reports no hash for, and
 *    refuse its reads through the cache-owned filesystem seam.
 * 2. Deliver every module and assert the cache still hits once.
 * 3. Allow the reads again without touching metadata, and assert the next delivery
 *    replaces the generation.
 */
export const test_transformttsc_unreadable_host_input_keeps_the_content_comparison =
  async () => {
    await assertUnreadableHostInputKeepsTheContentComparison();
  };
