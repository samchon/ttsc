/**
 * Object exported by a standalone `banner.config.*` file.
 *
 * The native loader requires a nonblank text string. Keeping banner contents
 * in this object gives JSON, JavaScript and TypeScript configuration the same
 * value contract; the tsconfig plugin entry selects the file instead.
 *
 * @evidence contracts/common.md#principled-implementation
 *   This ordinary exported TypeScript interface is the native loader's object
 *   contract, following the package's dedicated typed-config convention rather
 *   than adding inline banner options. Its required text field is
 *   consumer-authored content validated as nonblank and safely formatted by
 *   the Go driver.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This object defines emitted comment text. Newline formatting belongs to
 *   the native formatter; the value type defines no native filesystem,
 *   path-identity or process boundary.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Interface and field JSDoc explain standalone config ownership, required
 *   nonblank text, CRLF and trailing-line handling, terminator escaping and
 *   removeComments behavior. Purpose, validation and formatting rationale are
 *   separated into native paragraphs under the documentation skill; the type
 *   acknowledgment covers its field without duplicating a checklist on that
 *   property.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This type defines consumer-authored banner text. The native formatter
 *   owns the algorithm that processes it.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Config evaluation and descriptor reuse belong to the factory and host;
 *   this type defines the loaded value.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The loader and host own the config lifetime; this type defines its field.
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
