import { assertBunAdapterFallsThroughWhenItDoesNotTransform } from "../../internal/adapter-bun";

/**
 * Verifies the Bun adapter does not claim modules it did not transform.
 *
 * Bun stops its loader chain at the first `onLoad` callback that returns a
 * value. Returning the original source for an excluded or unchanged file
 * shadows later plugins and Bun's built-in loader.
 *
 * 1. Request a missing TypeScript path inside `node_modules`.
 * 2. Request a project source with ttsc plugins disabled.
 * 3. Assert both return `undefined`, and the excluded path is never read.
 */
export const test_bun_adapter_falls_through_for_excluded_and_unchanged_modules =
  async () => {
    await assertBunAdapterFallsThroughWhenItDoesNotTransform();
  };
