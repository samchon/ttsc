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
 *
 * @evidence contracts/testing.md#behavioral-verification The authored transformer passes JavaScript source and filename unchanged to the declared upstream callback.
 * @evidence contracts/testing.md#independent-expectations The literal authored JavaScript and original filename must survive a contractually excluded compiler pass.
 * @evidence contracts/testing.md#distinguishing-cases JavaScript pass-through contrasts native TypeScript transformation and declaration-file rejection from compiler work.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_passes_javascript_files_to_the_upstream =
  async () => {
    await assertPassesJavaScriptThrough();
  };
