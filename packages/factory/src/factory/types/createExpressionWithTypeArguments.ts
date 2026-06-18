import type {
  Expression,
  ExpressionWithTypeArguments,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ExpressionWithTypeArguments}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param typeArguments The generic type arguments, if any.
 * @returns The created {@link ExpressionWithTypeArguments}.
 */
export const createExpressionWithTypeArguments = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
): ExpressionWithTypeArguments =>
  make("ExpressionWithTypeArguments", { expression, typeArguments });
