/**
 * An elision (a hole) in an array literal or binding pattern.
 *
 * Built by {@link factory.createOmittedExpression}.
 *
 * The node itself prints no text. Enclosing array-list punctuation gives the
 * hole its position; a hole is not a standalone expression with a value.
 *
 * @evidence contracts/common.md#principled-implementation The discriminant alone represents the absence of an array entry; surrounding commas carry the positional meaning rather than an invented operand.
 * @evidence contracts/common.md#clear-and-simple-design No payload is needed for a hole; the enclosing array or pattern owns position and separators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit elision does not replace a missing entry with undefined or a fixture-specific placeholder value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains zero-text emission and the enclosing-list dependency; the acknowledgment block follows documentation paragraph guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface OmittedExpression {
  /** Discriminant tag; always `"OmittedExpression"`. */
  kind: "OmittedExpression";
}
