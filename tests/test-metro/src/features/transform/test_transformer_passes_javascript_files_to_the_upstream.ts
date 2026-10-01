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
 * @evidence contracts/testing.md#behavioral-verification transform on /workspace/app/src/app.js with options { dev: true } delivers to the fake upstream the identical source string and filename.
 * @evidence contracts/testing.md#independent-expectations The authored source and filename are compared with strict equality against what the echoing upstream received. Oracle limit: equality of the received source cannot by itself prove that no compile was attempted.
 * @evidence contracts/testing.md#distinguishing-cases Only a .js input is run; the TypeScript compile path and other pass-through reasons (declaration, exclude, include) are separate entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process against a fake CommonJS upstream that echoes its params; no native compile, consumer install or Metro host.
 */
export const test_transformer_passes_javascript_files_to_the_upstream =
  async () => {
    await assertPassesJavaScriptThrough();
  };
