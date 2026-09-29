import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/**
 * Structured payload inside `ITtscResult.result` for `build` and `check`.
 *
 * `output` maps emit-destination paths to file contents. Paths inside `cwd` are
 * relative; outside destinations remain absolute. `check` returns an empty map.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A path-keyed string record matches the native JSON output map; optional
 *   diagnostics reflect its omitempty encoding rather than requiring a sentinel.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Diagnostics and emitted files have separate fields, reusing one diagnostic
 *   type while keeping the transport envelope outside this compile payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Compiler-produced paths and contents remain data, without fixture-shaped keys.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the enclosing envelope, path base and no-emit meaning;
 *   separate paragraphs follow the documentation skill's purpose and context rule.
 */
export interface ITtscCompileResult {
  /** Present when the native result includes diagnostic messages. */
  diagnostics?: ITtscDiagnostic[];

  /** Emitted file contents keyed by their destination paths. */
  output: Record<string, string>;
}
