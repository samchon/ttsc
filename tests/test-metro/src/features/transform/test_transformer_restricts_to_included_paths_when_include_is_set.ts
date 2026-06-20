import { assertNonIncludedPathPassesThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer restricts to included paths when `include` is set.
 *
 * Pins the include boundary: once any include pattern is configured, a `.ts`
 * file that matches none of them must pass straight through rather than enter
 * the ttsc pass.
 *
 * 1. Configure a single `include` pattern.
 * 2. Run the transformer on a `.ts` file outside that pattern.
 * 3. Assert the upstream received the original source (no ttsc transform).
 */
export const test_transformer_restricts_to_included_paths_when_include_is_set =
  async () => {
    await assertNonIncludedPathPassesThrough();
  };
