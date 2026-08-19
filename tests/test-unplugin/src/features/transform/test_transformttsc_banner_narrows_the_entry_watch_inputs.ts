import { assertBannerNarrowsTheEntryWatchInputs } from "../../internal/transform-linked-completeness";

/**
 * Verifies a banner project stops registering a module's reference closure.
 *
 * The consumer half of samchon/ttsc#1263 and samchon/ttsc#1259: `@ttsc/banner`
 * prepends one config-derived text to every file and declares that its whole
 * contribution to each of them is that text, while the host's own printing is
 * syntactic. Without the declaration each delivered module re-proves every file
 * its imports reach, which for a real program is the dominant per-delivery
 * cost.
 *
 * 1. Build a project whose entry imports a type-only sibling, wired to
 *    `@ttsc/banner`.
 * 2. Transform the entry and collect the derived watch inputs.
 * 3. Assert the sibling is absent while the config chain and the banner config
 *    remain.
 */
export const test_transformttsc_banner_narrows_the_entry_watch_inputs =
  async () => {
    await assertBannerNarrowsTheEntryWatchInputs();
  };
