/**
 * Diagnostic information from the ttsc TypeScript-Go compiler.
 *
 * Represents standardized diagnostic information produced during a
 * TypeScript-Go compilation. This interface provides a simplified and
 * consistent representation of TypeScript's diagnostic structure without
 * requiring callers to depend on TypeScript-Go's internal Go types or parse
 * terminal output.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ITtscCompilerDiagnostic {
  /**
   * The filename where the diagnostic originated, or null if not
   * file-specific.
   *
   * Global diagnostics such as invalid compiler options or host-level failures
   * are reported with `null` because they are not tied to a single source file.
   */
  file: string | null;

  /**
   * The severity category of the diagnostic.
   *
   * Values follow TypeScript's diagnostic categories: error, warning,
   * suggestion, and message.
   */
  category: ITtscCompilerDiagnostic.Category;

  /**
   * The error code or identifier associated with this diagnostic.
   *
   * TypeScript diagnostics normally use numeric codes such as `2322`. Native
   * plugins may use stable string identifiers for plugin-defined diagnostics.
   */
  code: number | string;

  /**
   * The starting position of the issue in the source file, if available.
   *
   * TypeScript-Go reports this as a zero-based character offset. It is omitted
   * for global diagnostics or messages that do not expose a source offset.
   */
  start?: number;

  /**
   * The length of the problematic section in the source file, if available.
   *
   * Omitted when TypeScript-Go or a native plugin reports only a point
   * location, or when the diagnostic is not tied to a source file.
   */
  length?: number;

  /**
   * 1-based line number where the diagnostic starts, if available.
   *
   * This follows TypeScript's display convention rather than TypeScript-Go's
   * zero-based internal line index.
   */
  line?: number;

  /**
   * 1-based character (column) position where the diagnostic starts, if
   * available.
   *
   * This follows TypeScript's display convention rather than TypeScript-Go's
   * zero-based internal column index.
   */
  character?: number;

  /**
   * The human-readable diagnostic message describing the issue.
   *
   * Message chains are flattened into text so callers do not need to depend on
   * TypeScript-Go's internal diagnostic representation.
   */
  messageText: string;
}

export namespace ITtscCompilerDiagnostic {
  /**
   * Possible severity categories for diagnostics.
   *
   * - `"warning"`: issues that might cause problems but do not necessarily
   *   prevent compilation.
   * - `"error"`: issues that prevent successful compilation.
   * - `"suggestion"`: recommendations for code improvement.
   * - `"message"`: informational notes without warning or error severity.
   */
  export type Category = "warning" | "error" | "suggestion" | "message";
}
