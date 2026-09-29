/**
 * A single TypeScript compiler diagnostic emitted during `build`, `check`, or
 * `transform`. `line` and `character` are 1-based, matching the native driver.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Nullable file identity and optional locations mirror CompileDiagnostic's
 *   native JSON projection; the severity union matches its two public categories.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Diagnostic codes and locations come from the compiler rather than a guessed
 *   editor coordinate or a fixture-specific message classification.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains byte ranges, 1-based display locations and missing
 *   source context, following the documentation skill's units and absence rules.
 */
export interface ITtscDiagnostic {
  /** Absolute slash-separated source path; null for project-wide diagnostics. */
  file: string | null;

  /** Error affects the exit code; warning does not. */
  category: "error" | "warning";

  /** Native compiler or plugin diagnostic identifier. */
  code: number;

  /** Inclusive UTF-8 byte offset when source location is available. */
  start?: number;

  /** Span length in UTF-8 bytes when source location is available. */
  length?: number;

  /** 1-based source line; omitted when no display location is available. */
  line?: number;

  /** 1-based UTF-8 byte column; omitted when no display location is available. */
  character?: number;

  /** Complete diagnostic message for presentation to the caller. */
  messageText: string;
}
