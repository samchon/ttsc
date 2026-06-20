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
 */
export const test_transformer_excludes_configured_paths_from_the_ttsc_pass =
  async () => {
    await assertExcludedPathPassesThrough();
  };
