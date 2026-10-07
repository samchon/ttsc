/**
 * A BigInt literal expression.
 *
 * Built by {@link factory.createBigIntLiteral}.
 *
 * The printer emits text verbatim. Supply valid literal spelling; this type
 * does not parse digits or represent the evaluated bigint value.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Text includes the n suffix because the printer emits a lexical bigint token directly; valid digits and spelling remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One text field preserves spelling without a numeric value plus a second formatting representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The suffix describes bigint grammar; the declaration supplies no special literal value or consumer-dependent branch.
 * @evidence contracts/common.md#meaningful-documentation Native prose states verbatim emission and lexical validity, and the member states suffix ownership with documentation-compliant separation.
 */
export interface BigIntLiteral {
  /** Discriminant tag; always `"BigIntLiteral"`. */
  kind: "BigIntLiteral";

  /** The BigInt literal text, including the trailing `n`. */
  text: string;
}
