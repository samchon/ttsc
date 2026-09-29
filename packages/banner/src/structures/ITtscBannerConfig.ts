/**
 * Object exported by a standalone `banner.config.*` file.
 *
 * The native loader requires a nonblank text string. Keeping banner contents
 * in this object gives JSON, JavaScript and TypeScript configuration the same
 * value contract; the tsconfig plugin entry selects the file instead.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   This ordinary exported TypeScript interface is the native loader's object
 *   contract, following the package's dedicated typed-config convention
 *   rather than adding inline banner options. Its required text field is
 *   consumer-authored content validated as nonblank and safely formatted by
 *   the Go driver. The type performs no executable branch, foreign mutation,
 *   fixture matching or workaround; it describes this value shape, not the
 *   shared script-evaluation recorder.
 *
 * @evidenceExclude contracts/platform.md#portable-behavior
 *   This object defines emitted comment text. Newline formatting belongs to
 *   the native formatter; the value type defines no native filesystem,
 *   path-identity or process boundary.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The banner README defines nonblank text, not inline plugin options. The
 *   inspected native loader rejects absent, nonstring and whitespace-only
 *   text; its formatter normalizes CRLF, trims trailing blank lines and
 *   escapes comment terminators before normal comment emission. This
 *   interface cannot enforce those runtime constraints. Script evaluation
 *   also reaches the unresolved shared resolution recorder documented in
 *   .wiki/evidence-adoption/findings.md; the value contract does not certify
 *   that recorder.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Interface and field JSDoc explain standalone config ownership, required
 *   nonblank text, CRLF and trailing-line handling, terminator escaping and
 *   removeComments behavior. Purpose, validation and formatting rationale are
 *   separated into native paragraphs under the documentation skill; the type
 *   acknowledgment covers its field without duplicating a checklist on that
 *   property.
 *
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
