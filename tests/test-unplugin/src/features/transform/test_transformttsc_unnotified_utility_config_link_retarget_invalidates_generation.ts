import { assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a same-byte link retarget is rejected with notifications unusable.
 *
 * The neighbouring retarget case closes the watcher, which keeps the generation
 * on the narrow path and proves that path's universal-input manifest. A watcher
 * that _failed_ falls back to complete-snapshot validation instead, and that
 * snapshot records physical identities for graph members only — a plugin host
 * input is not one. Losing notifications must not lower the standard the narrow
 * path holds, so the fallback proves the same manifest.
 *
 * 1. Point a banner config dependency at a linked directory and transform.
 * 2. Fail every registered watcher through the cache-owned watch seam.
 * 3. Retarget the link to a byte-identical selection whose own transitive require
 *    differs, and assert the generation is replaced and the output follows the
 *    new target.
 */
export const test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation =
  async () => {
    await assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform();
  };
