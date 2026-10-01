import { assertExcludedPathPassesThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer excludes configured paths from the ttsc pass.
 *
 * The negative twin of a transformed file: identical `.ts` extension, but a
 * path matching an `exclude` substring must bypass the ttsc pass and reach the
 * upstream with its source unchanged.
 *
 * 1. Run the transformer on a `.ts` file whose path matches an `exclude` pattern.
 * 2. Assert the upstream received the original source (no ttsc transform).
 *
 * @evidence contracts/testing.md#behavioral-verification A TypeScript path matching generated exclusion passes its exact source to upstream without compilation.
 * @evidence contracts/testing.md#independent-expectations Documented exclusion precedence requires the original typed source to remain exact.
 * @evidence contracts/testing.md#distinguishing-cases An excluded TypeScript source contrasts admitted TypeScript native execution and include filtering.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_excludes_configured_paths_from_the_ttsc_pass =
  async () => {
    await assertExcludedPathPassesThrough();
  };
