/**
 * A numeric literal expression.
 *
 * Built by {@link factory.createNumericLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NumericLiteral {
  /** Discriminant tag; always `"NumericLiteral"`. */
  kind: "NumericLiteral";

  /** The numeric literal text. */
  text: string;
}
