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
 * @evidence contracts/testing.md#behavioral-verification Three new hashed JavaScript bundles outside configured inputs keep the key while a new src/late.ts changes it.
 * @evidence contracts/testing.md#independent-expectations Program input membership excludes JavaScript when allowJs is absent and admits authored TypeScript sources; this oracle does not copy traversal output.
 * @evidence contracts/testing.md#distinguishing-cases Repeated generated-output appearances contrast one new supported source, preventing an always-stable implementation from passing.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_ignores_output_in_an_unlisted_directory =
  async () => {
    await assertCacheKeyIgnoresOutputInAnUnlistedDirectory();
  };
