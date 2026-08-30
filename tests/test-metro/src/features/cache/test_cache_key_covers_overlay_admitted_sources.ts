import { assertCacheKeyCoversOverlayAdmittedSources } from "../../internal/metro-cache";

/**
 * Verifies the cache key covers a source the caller's overlay admits.
 *
 * See {@link assertCacheKeyCoversOverlayAdmittedSources}: samchon/ttsc#1316's
 * acceptance criterion, that `getCacheKey` responds to a `.js` file under
 * `compilerOptions: { allowJs: true }` and leaves the key alone without it.
 */
export const test_cache_key_covers_overlay_admitted_sources = async () => {
  await assertCacheKeyCoversOverlayAdmittedSources();
};
