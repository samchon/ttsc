import type { CallExpression, Expression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallExpression}: a function or method call.
 *
 * The optional `typeArguments` are printed in `<...>` before the argument list.
 * The arguments are printed comma separated inside the parentheses, and a
 * missing `argumentsArray` is treated as an empty list.
 *
 * Given callee `fn` and arguments `a`, `b`, the printer emits:
 *
 * ```ts
 * fn(a, b)
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The ordinary-call kind retains its callee boundary and ordered operands, normalizing absent arguments to empty parentheses; callable and argument validity are not checked here.
 * @evidence contracts/common.md#clear-and-simple-design One make call constructs the invocation outline; generic and value argument delimiters remain printer-owned.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The empty-list default is the documented no-arguments form, not a consumer-based invocation or a fabricated result.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states generic placement and missing-argument normalization with a direct expression example and separated acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The callee expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The call arguments.
 * @returns The created {@link CallExpression}.
 */
export const createCallExpression = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): CallExpression =>
  make("CallExpression", {
    expression,
    typeArguments,
    arguments: argumentsArray ?? [],
  });
