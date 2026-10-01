import { assertCacheKeyIgnoresOutputInAnUnlistedDirectory } from "../../internal/metro-cache";

/**
 * Verifies emitted output in an unnamed directory leaves the cache key alone.
 *
 * See {@link assertCacheKeyIgnoresOutputInAnUnlistedDirectory}: the Metro half
 * of samchon/ttsc#1307, required by samchon/ttsc#1317 and missing when that
 * work merged.
 *
 * 1. Prepare a TypeScript-only project and capture its key.
 * 2. Write three differently named JavaScript bundles and assert unchanged keys.
 * 3. Create a supported TypeScript source and assert invalidation.
 *
 * @evidence contracts/testing.md#behavioral-verification After prepareSnapshot, writing three differently named JavaScript files under lib/ leaves getCacheKey equal to its earlier value after each write, and then adding src/late.ts makes it differ.
 * @evidence contracts/testing.md#independent-expectations The project has no allowJs, so .js is not a program input, while a new .ts under the src include is; the equal and not-equal expectations follow from that membership rule rather than from traversal output.
 * @evidence contracts/testing.md#distinguishing-cases Three generated-output appearances (negative) contrast one new supported source (positive), so an implementation that never re-keys cannot pass.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey from fresh transformer modules in-process over a temp project; no native compile, consumer install or Metro host.
 */
export const test_cache_key_ignores_output_in_an_unlisted_directory =
  async () => {
    await assertCacheKeyIgnoresOutputInAnUnlistedDirectory();
  };
