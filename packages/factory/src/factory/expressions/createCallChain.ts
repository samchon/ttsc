import type { CallChain, Expression, Token, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallChain}: a call that participates in an optional chain.
 *
 * The `questionDotToken` is the `?.` token. When it sits directly before the
 * argument list the printer emits an optional call `fn?.(args)`; when the
 * callee is a property-access chain the `?.` appears at that link and the call
 * itself uses plain parentheses. The optional `typeArguments` are printed in
 * `<...>` before the arguments, and a missing `argumentsArray` is treated as an
 * empty list.
 *
 * Given a property-access chain `obj?.fn` and one argument `a`, the printer
 * emits:
 *
 * ```ts
 * obj?.fn(a);
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The callee expression.
 * @param questionDotToken The `?.` token, if the call link is optional.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The call arguments.
 * @returns The created {@link CallChain}.
 */
export const createCallChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): CallChain =>
  make("CallChain", {
    expression,
    questionDotToken,
    typeArguments,
    arguments: argumentsArray ?? [],
  });
