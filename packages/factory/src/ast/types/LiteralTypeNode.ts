import type { BigIntLiteral } from "../expressions/BigIntLiteral";
import type { NumericLiteral } from "../expressions/NumericLiteral";
import type { StringLiteral } from "../expressions/StringLiteral";
import type { Token } from "../names/Token";

/**
 * A literal type, e.g. `"red"` or `42`.
 *
 * Built by {@link factory.createLiteralTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface LiteralTypeNode {
  /** Discriminant tag; always `"LiteralTypeNode"`. */
  kind: "LiteralTypeNode";

  /** The literal. */
  literal: StringLiteral | NumericLiteral | BigIntLiteral | Token;
}
