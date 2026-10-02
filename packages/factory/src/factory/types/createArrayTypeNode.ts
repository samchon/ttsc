import type { ArrayTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrayTypeNode}: a `T[]` postfix array type.
 *
 * The element type is emitted in postfix-operand position, so a
 * lower-precedence form that would otherwise re-associate gets wrapped in
 * parentheses first. A union, intersection, function, constructor, conditional,
 * infer, type-operator, or type-query element prints as `(...)[]`; anything else
 * prints bare.
 *
 * Given a `string` element, the printer renders:
 *
 * ```ts
 * string[]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The element type remains a child of ArrayTypeNode rather than a textual
 *   suffix; the printer groups low-precedence elements before applying [].
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One element field models the postfix constructor; no alternate array
 *   representation or printer-specific text is cached in the factory.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Array syntax comes from the discriminant and element, without recognizing
 *   particular element names or replacing their emitted source.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description explains why element grouping matters and provides
 *   an array example with the sole argument and return type documented.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elementType The element type.
 * @returns The created {@link ArrayTypeNode}.
 */
export const createArrayTypeNode = (elementType: TypeNode): ArrayTypeNode =>
  make("ArrayTypeNode", { elementType });
