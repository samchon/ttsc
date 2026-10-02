/**
 * A numeric literal expression.
 *
 * Built by {@link factory.createNumericLiteral}.
 *
 * The printer emits text verbatim, preserving spellings such as hexadecimal
 * notation. The type does not parse or validate a numeric literal token.
 *
 * @evidence contracts/common.md#principled-implementation A text field retains lexical numeric spelling without conversion to a floating-point value; valid literal text remains a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design One spelling field is sufficient for direct literal emission; there is no redundant parsed value or formatting policy in the type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Numeric source is supplied explicitly rather than selected from expected values or rewritten for a particular consumer.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains preserved spelling and lack of lexical validation; the member and acknowledgment block remain separate under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NumericLiteral {
  /** Discriminant tag; always `"NumericLiteral"`. */
  kind: "NumericLiteral";

  /** The numeric literal text. */
  text: string;
}
