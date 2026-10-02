import type { Expression, SpreadElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadElement}: a `...expression` element that spreads an
 * iterable into an array literal or argument list.
 *
 * `expression` is the source iterable. The printer prefixes it with `...` and
 * no separating space.
 *
 * With `expression` of `a` inside an array literal, the printer emits:
 *
 * ```ts
 * [...a]
 * ```
 *
 * In an array assignment pattern the operand denotes a rest target instead.
 * Iterability, legal targets and rest placement are not checked by construction.
 *
 * @evidence contracts/common.md#principled-implementation The supplied operand remains spread or assignment-rest syntax according to its enclosing list; valid iterability, target and placement conditions are caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One make call creates the list entry, leaving expansion position and comma policy to its owner and printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The source is not enumerated into fixture-specific elements or replaced by a patched iterator result.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains value and rest contexts plus validation limits; the array example and parameter documentation remain separate from tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The iterable expression to spread.
 * @returns The created {@link SpreadElement}.
 */
export const createSpreadElement = (expression: Expression): SpreadElement =>
  make("SpreadElement", { expression });
