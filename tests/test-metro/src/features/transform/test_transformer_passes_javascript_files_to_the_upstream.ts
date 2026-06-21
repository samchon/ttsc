import { assertPassesJavaScriptThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer passes JavaScript files to the upstream unchanged.
 *
 * The ttsc pass only handles TypeScript; a `.js` file must reach the upstream
 * Babel transformer with its source untouched. Running ttsc on it would, at
 * best, waste a project compile and, at worst, error.
 *
 * 1. Run the transformer on a `.js` file with the echoing fake upstream.
 * 2. Assert the upstream received the original source byte-for-byte.
 * 3. Assert the upstream received the original filename.
 */
export const test_transformer_passes_javascript_files_to_the_upstream =
  async () => {
    await assertPassesJavaScriptThrough();
  };
