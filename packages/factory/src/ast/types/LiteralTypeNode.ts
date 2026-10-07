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
 * Token and PrefixUnaryExpression are broader than valid literal types. Callers
 * supply a legal literal spelling; this wrapper performs no checking.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The literal union distinguishes text, numeric, bigint, signed and keyword spellings; broad unary/token alternatives are explicitly not semantic validation.
 * @evidence contracts/common.md#clear-and-simple-design One literal payload reuses expression representations rather than duplicating literal storage.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Literal values come from callers, with no fixture-derived type values.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates literal and negative forms and states permissive alternatives; paragraph separation follows the documentation skill.
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
