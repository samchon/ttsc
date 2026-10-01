import { assertCacheKeyIsDeterministicAndOptionSensitive } from "../../internal/metro-transform";

/**
 * Verifies getCacheKey is deterministic and option-sensitive.
 *
 * Metro folds the transformer's cache key into its persistent transform cache.
 * The key must be stable for identical options (so cache hits work) yet change
 * when options change (so stale transforms are not served). A non-stable
 * stringify or a missing option input would break one side or the other.
 *
 * 1. Compute getCacheKey twice for the same options.
 * 2. Assert it is a 64-char hex digest, equal across the two calls.
 * 3. Compute it for a different option set and assert it differs.
 *
 * @evidence contracts/testing.md#behavioral-verification One prepared project yields equal keys for repeated exclude:a and a different key for exclude:b, retaining the 64-character digest.
 * @evidence contracts/testing.md#independent-expectations The cache contract equates unchanged inputs and separates changed options independently of digest computation.
 * @evidence contracts/testing.md#distinguishing-cases Same-option repetition is the stability control beside a one-field option mutation.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_cache_key_is_deterministic_and_option_sensitive =
  async () => {
    await assertCacheKeyIsDeterministicAndOptionSensitive();
  };
