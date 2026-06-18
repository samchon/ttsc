import type { Node } from "../../ast";

/**
 * Create a node array from the given elements.
 *
 * Unlike the legacy compiler, this package does not wrap the elements in a
 * dedicated node-array object. It returns the plain readonly array as-is (an
 * empty array when no elements are passed), so the result has no `kind` and is
 * not itself a printable node. It exists for signature parity where a node
 * array is expected.
 *
 * Given identifiers `a` and `b`, the result is simply the array holding those
 * two nodes, equivalent to writing the array literal yourself:
 *
 * ```ts
 * [a, b];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The given elements as a readonly array.
 */
export const createNodeArray = <T extends Node>(
  elements: readonly T[] = [],
): readonly T[] => elements;
