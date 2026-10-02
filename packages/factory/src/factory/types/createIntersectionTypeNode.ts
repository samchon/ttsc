import type { IntersectionTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IntersectionTypeNode}: an `A & B` type.
 *
 * The constituents are joined with `&`. The printer is width-aware: when the
 * whole intersection fits on one line it stays inline as `A & B`, and when it
 * has to break it indents and puts each constituent on its own line with a
 * leading `&`, including a leading `&` before the first member.
 *
 * Given the constituents `A` and `B`, the printer renders:
 *
 * ```ts
 * A & B
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered constituent types remain an intersection node; the printer groups
 *   lower-precedence constituents rather than changing their intersection meaning.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single list models the composition without flattening nested nodes or
 *   implementing assignability and intersection reduction in a constructor.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Constituent names and expected results do not select branches; empty or
 *   invalid caller outlines are not disguised with a fabricated fallback type.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the intersection list and its layout, with an example of the
 *   bare type and the constituent array documented.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link IntersectionTypeNode}.
 */
export const createIntersectionTypeNode = (
  types: readonly TypeNode[],
): IntersectionTypeNode => make("IntersectionTypeNode", { types });
