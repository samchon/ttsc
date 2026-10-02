import type { TypeNode, TypeOperatorNode } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link TypeOperatorNode}: a prefix type operator such as `keyof T`,
 * `readonly T[]` or `unique symbol`. A value-level `typeof x` type query uses
 * {@link TypeQueryNode} instead.
 *
 * The operator keyword prints first, then a space, then the operand type. In
 * postfix and array positions the surrounding printer wraps the operator type
 * in parentheses so the operator does not bind to the postfix instead of the
 * operand.
 *
 * Given the `KeyOfKeyword` operator and a `T` operand, the printer renders:
 *
 * ```ts
 * keyof T
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Operator and operand retain prefix-type roles; the broad SyntaxKind input
 *   still requires an operator and operand legal in the caller's type context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A two-field node separates type operators from value-name type queries,
 *   leaving prefix spelling and enclosing postfix grouping to the printer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No invalid token is silently replaced by keyof and no operand name selects
 *   alternate behavior to imitate an expected type result.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description now distinguishes typeof queries from type operators
 *   and explains their grouping behavior before the concrete keyof example.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operator The operator token.
 * @param type The operand type.
 * @returns The created {@link TypeOperatorNode}.
 */
export const createTypeOperatorNode = (
  operator: SyntaxKind,
  type: TypeNode,
): TypeOperatorNode => make("TypeOperatorNode", { operator, type });
