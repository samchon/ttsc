import type { Expression, Token, YieldExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link YieldExpression}: a `yield` inside a generator.
 *
 * `asteriskToken`, when present, makes this a delegating `yield*`; otherwise a
 * plain `yield` is emitted. `expression` is the yielded value and may be
 * omitted for a bare `yield`. When a value is present the printer separates the
 * keyword from it with a single space; `yield*` attaches the asterisk directly
 * to the keyword.
 *
 * With no asterisk and `expression` of `x`, the printer emits:
 *
 * ```ts
 * yield x
 * ```
 *
 * Delegating yield requires an operand, unlike bare yield. Callers establish
 * valid generator context and delegation input; construction validates neither.
 *
 * @evidence contracts/common.md#principled-implementation Optional marker and operand retain bare, value-bearing and delegating yield syntax; a delegating operand and valid generator context are caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores the two optional constituents without iterator runtime state or a second yield schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder does not patch an iterator or substitute known yielded results for supplied expression syntax.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains marker presence, bare yield and delegated-input requirements, with an expression example and separated parameter/tag blocks.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param asteriskToken The `*` token for a delegating `yield*`, if any.
 * @param expression The yielded value, if any.
 * @returns The created {@link YieldExpression}.
 */
export const createYieldExpression = (
  asteriskToken: Token | undefined,
  expression: Expression | undefined,
): YieldExpression => make("YieldExpression", { asteriskToken, expression });
