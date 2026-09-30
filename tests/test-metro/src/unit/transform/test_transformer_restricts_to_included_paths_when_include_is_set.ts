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
 *
 * @evidence contracts/testing.md#behavioral-verification A TypeScript path outside the supplied include pattern reaches upstream with its original source.
 * @evidence contracts/testing.md#independent-expectations The include contract selects only matching paths; exact typed fixture text distinguishes accidental compilation.
 * @evidence contracts/testing.md#distinguishing-cases Nonmatching include contrasts matching include and explicit exclusion.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_restricts_to_included_paths_when_include_is_set =
  async () => {
    await assertNonIncludedPathPassesThrough();
  };
