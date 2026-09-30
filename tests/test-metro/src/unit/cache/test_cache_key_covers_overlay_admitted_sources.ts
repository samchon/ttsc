import { assertCacheKeyCoversOverlayAdmittedSources } from "../../internal/metro-cache";

/**
 * Verifies the cache key covers a source the caller's overlay admits.
 *
 * See {@link assertCacheKeyCoversOverlayAdmittedSources}: samchon/ttsc#1316's
 * acceptance criterion, that `getCacheKey` responds to a `.js` file under
 * `compilerOptions: { allowJs: true }` and leaves the key alone without it.
 *
 * 1. Prepare a project with inherited output exclusions and an allowJs overlay.
 * 2. Edit and create JavaScript, create replacement output and old declaration-path sources.
 * 3. Compare every key relationship, then remove the overlay and verify JavaScript is ignored.
 *
 * @evidence contracts/testing.md#behavioral-verification allowJs makes edited and newly appearing JavaScript sources change keys; overlay outputs stay excluded, replaced inherited declaration paths become sources, and strict mode ignores JavaScript.
 * @evidence contracts/testing.md#independent-expectations The compiler overlay contract specifies admitted extensions and replacement output paths independently of the fingerprint implementation.
 * @evidence contracts/testing.md#distinguishing-cases JavaScript edit/appearance, emitted-output negatives, inherited-path create/edit/delete and strict controls retain every original key relationship.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_covers_overlay_admitted_sources = async () => {
  await assertCacheKeyCoversOverlayAdmittedSources();
};
