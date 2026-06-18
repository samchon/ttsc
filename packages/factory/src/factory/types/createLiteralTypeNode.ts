import type {
  BigIntLiteral,
  LiteralTypeNode,
  NumericLiteral,
  PrefixUnaryExpression,
  StringLiteral,
  Token,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link LiteralTypeNode}: a literal used in type position such as
 * `"foo"`, `42`, `true`, or `null`.
 *
 * The printer emits the wrapped literal directly, so the rendered text is
 * exactly that literal's own source. A {@link PrefixUnaryExpression} covers
 * negative numeric literals such as `-1`, and a {@link Token} covers keyword
 * literals such as `true`, `false`, and `null`.
 *
 * Given a `"foo"` string literal, the printer renders:
 *
 * ```ts
 * "foo";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param literal The literal; a {@link PrefixUnaryExpression} covers negative
 *   numeric literals such as `-1`.
 * @returns The created {@link LiteralTypeNode}.
 */
export const createLiteralTypeNode = (
  literal:
    | StringLiteral
    | NumericLiteral
    | BigIntLiteral
    | PrefixUnaryExpression
    | Token,
): LiteralTypeNode => make("LiteralTypeNode", { literal });
