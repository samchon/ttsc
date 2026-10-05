import type { CallChain, Expression, Token, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallChain}: a call that participates in an optional chain.
 *
 * The `questionDotToken` controls this call link: presence emits `fn?.(args)`;
 * absence uses plain parentheses while retaining any chain in the callee. A
 * callee's optional-access marker is independent of this call marker, so
 * `obj?.fn?.()` can contain both. The optional `typeArguments` are printed in
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
 * @evidence contracts/common.md#principled-implementation Callee and optional-link marker retain chain continuation; undefined value arguments normalize to an empty list without moving the optional marker to another link.
 * @evidence contracts/common.md#clear-and-simple-design A direct chain node reuses its callee subtree and two ordered argument lists; the printer owns generic and call punctuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Marker presence and empty-argument normalization are explicit syntax contracts, not guessed nullability or a patched invocation result.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains this-link optionality, preceding-chain behavior and undefined arguments; example and parameters are separate from tags under documentation guidance.
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
