import type { ITtscResult } from "./structures/ITtscResult";

/**
 * Parse the `result` field of an ITtscResult into the structured payload.
 *
 * The wasm returns JSON as a string because `js.ValueOf` does not handle large
 * nested maps efficiently. Callers JSON.parse exactly once at the boundary.
 *
 * Returns null for empty or invalid JSON. The generic parameter describes the
 * expected payload; this function does not validate its schema or exit code.
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON.parse handles the native string envelope using the standard parser;
 *   the generic cast expresses the caller's expected endpoint payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Parser failure returns explicit null rather than synthesizing an expected
 *   payload. The cast is documented as an expectation, not runtime validation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate JSDoc paragraphs explain the boundary and failure/schema limits,
 *   following the documentation skill's guidance to give each paragraph one role.
 */
export function parseResult<T>(result: ITtscResult): T | null {
  if (!result.result) return null;
  try {
    return JSON.parse(result.result) as T;
  } catch {
    return null;
  }
}
