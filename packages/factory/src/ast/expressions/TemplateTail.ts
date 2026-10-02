/**
 * The final literal chunk after a template's last substitution.
 *
 * Built by {@link factory.createTemplateTail}.
 *
 * The printer supplies the preceding `}` and closing backtick. Raw content
 * takes precedence when supplied; otherwise cooked text is escaped. The tail
 * belongs at the end of a substituted template rather than standing alone.
 *
 * @evidence contracts/common.md#principled-implementation Cooked and optional raw text preserve the final chunk's content representations, while the tail kind determines terminal delimiters; it does not represent a complete template alone.
 * @evidence contracts/common.md#clear-and-simple-design The chunk owns only terminal content, with the enclosing template owning span placement and the printer owning delimiters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Terminal syntax follows an explicit tail node rather than an appended output correction or a guessed interpolation result.
 * @evidence contracts/common.md#meaningful-documentation Native prose and members identify final placement, delimiter exclusion and raw precedence, with documentation-compliant member and tag separation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateTail {
  /** Discriminant tag; always `"TemplateTail"`. */
  kind: "TemplateTail";

  /** Cooked final content, excluding the preceding brace and closing backtick. */
  text: string;

  /** Optional valid raw content emitted instead of escaped cooked text. */
  rawText?: string;
}
