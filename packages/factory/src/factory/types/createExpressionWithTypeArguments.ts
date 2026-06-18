import type {
  Expression,
  ExpressionWithTypeArguments,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ExpressionWithTypeArguments}: an `Expr<TypeArgs>` form used
 * in heritage clauses such as `extends Base<T>`.
 *
 * The expression prints first, followed by the type arguments as `<...>` when
 * present. With no type arguments only the bare expression prints.
 *
 * Given a `Foo` expression and a single `string` type argument, the printer
 * renders:
 *
 * ```ts
 * Foo<string>;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The base expression.
 * @param typeArguments The generic type arguments, if any.
 * @returns The created {@link ExpressionWithTypeArguments}.
 */
export const createExpressionWithTypeArguments = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
): ExpressionWithTypeArguments =>
  make("ExpressionWithTypeArguments", { expression, typeArguments });
