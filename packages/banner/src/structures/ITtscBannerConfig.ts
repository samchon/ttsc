/**
 * Object exported by a standalone `banner.config.*` file.
 *
 * The native loader requires a nonblank text string. Keeping banner contents
 * in this object gives JSON, JavaScript and TypeScript configuration the same
 * value contract; the tsconfig plugin entry selects the file instead.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A required string member expresses the loader's object payload. TypeScript
 *   cannot express nonblank contents through this string type, so the native
 *   loader validates that condition before formatting. The formatter preserves
 *   content lines while normalizing CRLF and escaping closing delimiters; it
 *   changes comment representation without treating text as executable source.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Banner content has one field in a dedicated config value. Registration and
 *   config discovery stay in ITtscBannerPluginConfig because they select the
 *   content's source rather than change its representation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The text is consumer content, not a fixture-selected banner or a hardcoded
 *   expected output. Required separators and the annotation are formatting
 *   constants in the driver rather than hidden options in this value.
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
