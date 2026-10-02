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
 * Foo<string>
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The expression and optional type arguments remain separate children of the
 *   heritage expression, preserving its base and generic argument order.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One outline node serves heritage clauses without synthesizing a call or a
 *   declaration; the parent determines extends/implements placement.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The builder neither resolves base classes nor special-cases their names;
 *   argument omission is represented directly rather than patched in text.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The example shows the expression itself without a statement terminator;
 *   JSDoc documents the base expression and optional argument list.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
