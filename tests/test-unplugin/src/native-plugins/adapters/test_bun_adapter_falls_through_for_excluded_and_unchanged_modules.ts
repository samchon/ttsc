import { assertBunAdapterFallsThroughWhenItDoesNotTransform } from "../../internal/adapter-bun/assertBunAdapterFallsThroughWhenItDoesNotTransform";

/**
 * Verifies excluded files and no-op transforms fall through to Bun's next
 * loader.
 *
 * Bun stops at the first `onLoad` callback that returns a value. The adapter's
 * broad TypeScript filter therefore must consult the shared `transformInclude`
 * predicate before reading and return `undefined` when the path is excluded or
 * the transform produced no code.
 */
export async function test_bun_adapter_falls_through_for_excluded_and_unchanged_modules(): Promise<void> {
  await assertBunAdapterFallsThroughWhenItDoesNotTransform();
}
