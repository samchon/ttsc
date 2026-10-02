import type { Expression, ThrowStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThrowStatement}: a `throw ...;` statement.
 *
 * The `expression` is the value raised, commonly a freshly constructed error.
 * Unlike `return`, the expression is required.
 *
 * When leading synthetic comments would separate `throw` from the expression's
 * first token with a line break, the printer wraps the expression in parentheses
 * to preserve the required no-line-terminator boundary.
 *
 * With an `expression` of `new Error("oops")`, the result is:
 *
 * ```ts
 * throw new Error("oops");
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The required Expression is the thrown value; source construction preserves
 *   it without evaluating or coercing an exception during factory execution.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Throw context is one wrapper around the value, leaving its syntax to child builders.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No error swallowing or successful fallback replaces the throw statement.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the required value and contrast with optional return values,
 *   with an Error-construction example separated from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ThrowStatement}.
 */
export const createThrowStatement = (expression: Expression): ThrowStatement =>
  make("ThrowStatement", { expression });
