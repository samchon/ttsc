/**
 * An elision (a hole) in an array literal or binding pattern.
 *
 * Built by {@link factory.createOmittedExpression}.
 *
 * The node itself prints no text. Enclosing array-list punctuation gives the
 * hole its position; a hole is not a standalone expression with a value.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The discriminant alone represents the absence of an array entry; surrounding commas carry the positional meaning rather than an invented operand.
 * @evidence contracts/common.md#clear-and-simple-design No payload is needed for a hole; the enclosing array or pattern owns position and separators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit elision does not replace a missing entry with undefined or a fixture-specific placeholder value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains zero-text emission and the enclosing-list dependency; the acknowledgment block follows documentation paragraph guidance.
 */
export interface OmittedExpression {
  /** Discriminant tag; always `"OmittedExpression"`. */
  kind: "OmittedExpression";
}
