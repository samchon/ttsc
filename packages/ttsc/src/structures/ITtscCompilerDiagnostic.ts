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
 * @evidence contracts/common.md#principled-implementation Nullable file identity distinguishes global findings from located findings; numeric or plugin string codes and optional coordinates preserve producer information without inventing locations.
 * @evidence contracts/common.md#clear-and-simple-design A flat diagnostic record exposes severity, identity, location and text without coupling JavaScript consumers to the native compiler's internal message-chain objects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Category names are the supported diagnostic vocabulary; plugin identifiers remain data rather than host-side special cases for known plugins.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states null-file semantics, producer coordinate units, optional spans and flattened text; member spacing and distinct descriptive/tag paragraphs follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation File names retain the producer's native path spelling, with null for global findings; offsets and native columns use UTF-8 bytes while rendered foreign columns retain their producer's unit, so consumers must not interpret them as UTF-16 protocol positions.
 */
export interface ITtscCompilerDiagnostic {
  /**
   * The filename where the diagnostic originated, or null if not file-specific.
   *
   * Global diagnostics such as invalid compiler options or host-level failures
   * are reported with `null` because they are not tied to a single source
   * file.
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
   * Native TypeScript-Go reports a zero-based UTF-8 byte offset. It is omitted
   * for global diagnostics or messages that do not expose a source offset.
   */
  start?: number;

  /**
   * The length of the problematic section in the source file, if available.
   *
   * Native TypeScript-Go reports a UTF-8 byte length. Omitted when it or a
   * native plugin reports only a point location, or when the diagnostic is not
   * tied to a source file.
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
   * 1-based column where the diagnostic starts, if available.
   *
   * Native TypeScript-Go reports a UTF-8 byte column. Diagnostics parsed from
   * another producer's rendered text retain that producer's column unit.
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
   *
   * @evidence contracts/common.md#principled-implementation Four literal severities preserve the TypeScript diagnostic categories used by host decoding, with no ordinal encoding assumption.
   * @evidence contracts/common.md#clear-and-simple-design The named union provides one shared severity vocabulary for all diagnostic consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts These literals represent protocol categories and do not classify by a diagnostic's text or a fixture code.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the intended severity of each literal in separate list entries and separates the acknowledgments, following the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
  export type Category = "warning" | "error" | "suggestion" | "message";
}
