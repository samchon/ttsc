/**
 * A complete backtick template literal without substitutions.
 *
 * Built by {@link factory.createNoSubstitutionTemplateLiteral}.
 *
 * Raw spelling takes precedence when supplied and must already be valid
 * template content. Otherwise the printer escapes cooked text. Neither field
 * includes the surrounding backticks.
 *
 * @evidence contracts/common.md#principled-implementation Cooked text and optional raw spelling distinguish a template's value from its lexical content; absence of substitutions makes this one span a complete expression.
 * @evidence contracts/common.md#clear-and-simple-design The two text representations share one literal node, while the printer owns escaping and surrounding delimiters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts rawText explicitly preserves source spelling rather than patching already printed output or selecting a known literal result.
 * @evidence contracts/common.md#meaningful-documentation Native prose and members state delimiter exclusion, raw precedence and escaping, with separated paragraphs and tags following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NoSubstitutionTemplateLiteral {
  /** Discriminant tag; always `"NoSubstitutionTemplateLiteral"`. */
  kind: "NoSubstitutionTemplateLiteral";

  /** Cooked content escaped for printing when rawText is absent. */
  text: string;

  /** Optional source spelling emitted verbatim instead of escaped cooked text. */
  rawText?: string;
}
