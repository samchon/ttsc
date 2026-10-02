import type { RestTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link RestTypeNode}: a `...T` rest element inside a tuple type.
 *
 * A leading `...` prints in front of the type. This form is only valid in tuple
 * element position, for example `[string, ...number[]]`.
 *
 * Given a `string[]` element type, the printer renders:
 *
 * ```ts
 * ...string[]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   RestTypeNode retains the operand as a type child so postfix grouping stays
 *   meaningful; the caller supplies a legal rest position and operand type.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A one-child wrapper separates tuple-rest syntax from expression spread and
 *   leaves tuple ordering to its parent rather than duplicating list validation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No element names trigger an array conversion or output substitution; the
 *   explicit rest wrapper is preserved for every supplied operand.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains the tuple-rest role and operand, with a distinct
 *   paragraph for the example and spacing before the acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The rest element type.
 * @returns The created {@link RestTypeNode}.
 */
export const createRestTypeNode = (type: TypeNode): RestTypeNode =>
  make("RestTypeNode", { type });
