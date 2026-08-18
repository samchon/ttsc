import { assertUnsettledMetadataKeepsTheContentComparison } from "../../internal/transform-project-cache";

/**
 * Verifies an input whose metadata clock has not settled keeps its content read.
 *
 * A metadata signature stands for content only while a later write would move
 * it, and filesystem timestamps advance in ticks. An input modified inside the
 * same tick its signature was captured in can be rewritten to a different
 * payload of the same length and keep that signature — measured at 156 of 200
 * back-to-back same-size rewrites on Windows, where Node also reports `ctime`
 * as the creation time rather than the last metadata change. Such an input must
 * never acquire a proof, which is the rule Git applies to a racily clean file.
 *
 * 1. Report a frozen future timestamp through the cache-owned metadata reads,
 *    so no signature can settle on any platform.
 * 2. Rewrite a reachable declaration to different content of the same length.
 * 3. Assert the next delivery still sees it and replaces the generation.
 */
export const test_transformttsc_unsettled_metadata_keeps_the_content_comparison =
  async () => {
    await assertUnsettledMetadataKeepsTheContentComparison();
  };
