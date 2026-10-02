import type { TupleTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TupleTypeNode}: a `[A, B]` tuple type.
 *
 * The elements print inside `[...]`, comma separated. The list is width-aware:
 * inline it stays on one line with no trailing comma, and when it breaks each
 * element goes on its own line with a trailing comma after the last. Elements
 * may include named, optional, and rest members.
 *
 * Given the elements `string` and `number`, the printer renders:
 *
 * ```ts
 * [string, number]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Element order remains part of TupleTypeNode's structure, including explicit
 *   named, optional and rest wrappers. The caller supplies valid member combinations.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single element array represents the tuple without converting it to an
 *   array union or reproducing delimiter layout in the factory.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No index-specific types or inferred tuple lengths replace the supplied
 *   elements; list legality is not disguised by dropping members.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains ordering, supported wrappers and width-dependent
 *   commas; the example shows the bare tuple type.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The tuple element types.
 * @returns The created {@link TupleTypeNode}.
 */
export const createTupleTypeNode = (
  elements: readonly TypeNode[],
): TupleTypeNode => make("TupleTypeNode", { elements });
