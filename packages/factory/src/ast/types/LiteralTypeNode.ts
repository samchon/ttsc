import type { BigIntLiteral } from "../expressions/BigIntLiteral";
import type { NumericLiteral } from "../expressions/NumericLiteral";
import type { PrefixUnaryExpression } from "../expressions/PrefixUnaryExpression";
import type { StringLiteral } from "../expressions/StringLiteral";
import type { Token } from "../names/Token";

/**
 * A literal type, e.g. `"red"`, `42` or `-1`.
 *
 * Built by {@link factory.createLiteralTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface LiteralTypeNode {
  /** Discriminant tag; always `"LiteralTypeNode"`. */
  kind: "LiteralTypeNode";

  /** The literal (a {@link PrefixUnaryExpression} covers negative numbers). */
  literal:
    | StringLiteral
    | NumericLiteral
    | BigIntLiteral
    | PrefixUnaryExpression
    | Token;
}
