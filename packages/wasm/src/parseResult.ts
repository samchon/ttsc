import type { ITtscResult } from "./structures/ITtscResult";

/**
 * Parse the `result` field of an ITtscResult into the structured payload.
 *
 * The wasm returns JSON as a string because `js.ValueOf` does not handle
 * large nested maps efficiently. Callers JSON.parse exactly once at the
 * boundary.
 */
export function parseResult<T>(result: ITtscResult): T | null {
  if (!result.result) return null;
  try {
    return JSON.parse(result.result) as T;
  } catch {
    return null;
  }
}
