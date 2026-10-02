import type { Expression, NewExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NewExpression}: a constructor call with `new`.
 *
 * `expression` is the constructor being invoked. `typeArguments`, when present,
 * are printed in angle brackets after the constructor. `argumentsArray` holds
 * the call arguments; an absent or empty list both print parentheses. The
 * outline does not check whether the supplied target is constructible.
 *
 * With `expression` of `Foo` and a single argument `a`, the printer emits:
 *
 * ```ts
 * new Foo(a)
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Constructor target and optional argument sequences remain supplied new-expression syntax; undefined arguments are preserved in the node but print as (), and constructibility remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One make call records the constituents, with target grouping and argument-list normalization owned by the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's target is not replaced by an injected constructor or a known instance; empty parentheses follow the documented printer contract.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absent-list behavior and constructibility limits, with direct expression example and separate parameters/tags under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The constructor expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The constructor arguments.
 * @returns The created {@link NewExpression}.
 */
export const createNewExpression = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): NewExpression =>
  make("NewExpression", {
    expression,
    typeArguments,
    arguments: argumentsArray,
  });
