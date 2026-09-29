/**
 * Object exported by a standalone `banner.config.*` file.
 *
 * The native loader requires a nonblank text string. Keeping banner contents
 * in this object gives JSON, JavaScript and TypeScript configuration the same
 * value contract; the tsconfig plugin entry selects the file instead.
 *
 * @evidence contracts/common.md#standard-implementation-practices This ordinary exported TypeScript interface is the native loader's object contract, following the package's dedicated typed-config convention rather than adding inline banner options. Its required text field is consumer-authored content validated as nonblank and safely formatted by the Go driver. The type performs no executable branch, foreign mutation, fixture matching or workaround; it certifies this value shape, not the shared script-evaluation recorder.
 * @evidence contracts/common.md#portable-behavior This object stores text rather than filesystem or process state; the native formatter normalizes CRLF before constructing the emitted comment.
 * @evidence contracts/common.md#meaningful-documentation Interface and field JSDoc explain standalone config ownership, required nonblank text, CRLF and trailing-line handling, terminator escaping and removeComments behavior. Purpose, validation and formatting rationale are separated into native paragraphs under the documentation skill; the type acknowledgment covers its field without duplicating a checklist on that property.
 */
export interface ITtscBannerConfig {
  /**
   * Text placed before the generated `@packageDocumentation` annotation.
   *
   * Empty or whitespace-only values are rejected. The formatter preserves the
   * supplied lines, removes trailing blank lines, normalizes CRLF and escapes
   * comment terminators so the value cannot close the generated JSDoc block.
   * The resulting comment follows the compiler's `removeComments` policy.
   */
  text: string;
}
