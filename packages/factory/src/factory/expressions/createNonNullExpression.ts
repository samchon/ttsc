import type { Expression, NonNullExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NonNullExpression}: a non-null assertion that suffixes
 * `expression` with `!`.
 *
 * The assertion strips `null` and `undefined` from the operand's type at
 * compile time. The printer appends a single `!` directly after the operand
 * with no space.
 *
 * With `expression` of `a`, the printer emits:
 *
 * ```ts
 * a!
 * ```
 *
 * This records the assertion without checking the operand or adding a runtime
 * null check. The chain-preserving variant is createNonNullChain.
 *
 * @evidence contracts/common.md#principled-implementation The ordinary non-null assertion kind wraps the supplied operand without evaluating it or preserving a chain-continuation kind; syntax construction does not establish non-nullness.
 * @evidence contracts/common.md#clear-and-simple-design A single make call owns the one-operand shape; the printer handles the assertion suffix and grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No default value, forced runtime check or expected operand result replaces the supplied expression.
 * @evidence contracts/common.md#meaningful-documentation Native prose states compile-time assertion intent, no runtime check and the chain variant, with a separate expression example and tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to assert as non-null.
 * @returns The created {@link NonNullExpression}.
 */
export const createNonNullExpression = (
  expression: Expression,
): NonNullExpression => make("NonNullExpression", { expression });
