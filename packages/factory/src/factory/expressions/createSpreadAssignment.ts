import type { Expression, SpreadAssignment } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadAssignment}: a `...expression` member that spreads one
 * object's properties into an object literal.
 *
 * `expression` is the source object. The printer prefixes it with `...` and no
 * separating space.
 *
 * With `expression` of `a` inside an object literal, the printer emits:
 *
 * ```ts
 * { ...a }
 * ```
 *
 * In an object assignment pattern the operand instead denotes the rest target.
 * The caller establishes legal target and rest placement for that context.
 *
 * @evidence contracts/common.md#principled-implementation The retained operand represents object spread in value context or rest in assignment context; the enclosing outline determines its role and caller-owned target validity.
 * @evidence contracts/common.md#clear-and-simple-design One operand feeds make, with the enclosing object owning order and the printer handling rest-context punctuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Spread is not expanded from a known object's properties into hardcoded assignments or patched consumer state.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes value-spread and assignment-rest roles, with an object-context example and separated acknowledgment block.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression to spread.
 * @returns The created {@link SpreadAssignment}.
 */
export const createSpreadAssignment = (
  expression: Expression,
): SpreadAssignment => make("SpreadAssignment", { expression });
