import type { TypeNode, TypeOperatorNode } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link TypeOperatorNode}: a prefix type operator such as `keyof T`,
 * `typeof x`, `readonly T[]`, or `unique symbol`.
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
 * @author Jeongho Nam - https://github.com/samchon
 * @param operator The operator token.
 * @param type The operand type.
 * @returns The created {@link TypeOperatorNode}.
 */
export const createTypeOperatorNode = (
  operator: SyntaxKind,
  type: TypeNode,
): TypeOperatorNode => make("TypeOperatorNode", { operator, type });
