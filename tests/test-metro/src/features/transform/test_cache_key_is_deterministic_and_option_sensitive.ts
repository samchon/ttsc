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
 * @evidence contracts/testing.md#behavioral-verification On one prepared project, getCacheKey returns the same 64-character string twice for options { exclude: ["a"] } and a different string for { exclude: ["b"] }.
 * @evidence contracts/testing.md#independent-expectations Equality for repeated identical inputs and inequality for a changed option follow from the cache-reuse contract; no digest is recomputed in the test.
 * @evidence contracts/testing.md#distinguishing-cases The repeated identical call is the stability control and the exclude ["b"] call is a one-field mutation against it.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey from three freshly loaded transformer modules in-process, each with TTSC_METRO_OPTIONS set and restored by the helper; no native compile, consumer install or Metro host.
 */
export const test_cache_key_is_deterministic_and_option_sensitive =
  async () => {
    await assertCacheKeyIsDeterministicAndOptionSensitive();
  };
