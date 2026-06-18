/**
 * A BigInt literal expression.
 *
 * Built by {@link factory.createBigIntLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BigIntLiteral {
  /** Discriminant tag; always `"BigIntLiteral"`. */
  kind: "BigIntLiteral";

  /** The BigInt literal text, including the trailing `n`. */
  text: string;
}
