import { assertUnreadableHostInputKeepsTheContentComparison } from "../../internal/transform-project-cache";

/**
 * Verifies a universal host input with no readable content never earns a proof.
 *
 * Descriptor and config inputs are validated through their own manifest, which
 * skips an entry whose metadata still matches. An input the host could see but
 * not read records the same missing state on both sides, so its comparison
 * succeeds while nothing reads it and its metadata never moves. A signature for
 * it would be skipped for the generation's life, and the per-module loop skips
 * the same spelling, so bytes appearing later would never be compared at all.
 *
 * 1. Declare one out-of-walk host input as a link with no target, the one shape
 *    the host's own filesystem and the adapter's fail to read alike.
 * 2. Deliver every module and assert the cache still hits once.
 * 3. Let its content appear through the cache-owned read alone, so no metadata
 *    moves, and assert the next delivery replaces the generation.
 */
export const test_transformttsc_unreadable_host_input_keeps_the_content_comparison =
  async () => {
    await assertUnreadableHostInputKeepsTheContentComparison();
  };
