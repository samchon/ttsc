import type { Expression, Statement, WithStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link WithStatement}: a `with (...) ...` statement.
 *
 * The `expression` supplies the object whose properties join the scope of
 * `statement`, the body. `with` is disallowed in strict mode and in ES modules,
 * so this exists mainly for completeness and faithful round-tripping.
 *
 * With an `expression` of `obj` and a `statement` block calling `a()`, the
 * result is:
 *
 * ```ts
 * with (obj) {
 *   a();
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Object expression and body retain with-statement syntax for source generation;
 *   valid use requires non-strict script context, as the factory cannot supply it.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The outline models syntax without creating a scope proxy or runtime wrapper.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supporting this explicit source kind does not use with inside library logic.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states strict-mode/ES-module restrictions and round-tripping use,
 *   with the source example separated from acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WithStatement}.
 */
export const createWithStatement = (
  expression: Expression,
  statement: Statement,
): WithStatement => make("WithStatement", { expression, statement });
