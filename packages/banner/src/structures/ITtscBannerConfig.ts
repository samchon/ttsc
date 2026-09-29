/**
 * Object exported by a standalone `banner.config.*` file.
 *
 * The native loader requires a nonblank text string. Keeping banner contents
 * in this object gives JSON, JavaScript and TypeScript configuration the same
 * value contract; the tsconfig plugin entry selects the file instead.
 *
 * @evidence contracts/common.md#no-implementation-shortcuts This interface describes the real config value accepted by the native loader; it introduces no fixture decisions, foreign mutation, test-only execution or compensating path.
 * @evidence contracts/common.md#portable-behavior This object stores text rather than filesystem or process state; the native formatter normalizes CRLF before constructing the emitted comment.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes the exported config value from the tsconfig entry and states the nonblank requirement, with purpose and rationale in separate JSDoc paragraphs.
 */
export interface ITtscBannerConfig {
  /**
   * Text placed before the generated `@packageDocumentation` annotation.
   *
   * Empty or whitespace-only values are rejected. The formatter preserves the
   * supplied lines, removes trailing blank lines, normalizes CRLF and escapes
   * comment terminators so the value cannot close the generated JSDoc block.
   * The resulting comment follows the compiler's `removeComments` policy.
   *
   * @evidence contracts/common.md#no-implementation-shortcuts The string is supplied by the user's config rather than a fixture or expected output; this member defines no mutation, executable branch or fallback.
   * @evidence contracts/common.md#portable-behavior The formatter's CRLF normalization gives this text the same comment layout across supported operating systems; the field performs no path or process operation.
   * @evidence contracts/common.md#meaningful-documentation The comment states validation, line handling, terminator escaping and emit policy rather than repeating the string type, using separate paragraphs and the formatting-safety reason.
   */
  text: string;
}
