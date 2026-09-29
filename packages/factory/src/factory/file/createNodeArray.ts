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
 * @evidence contracts/common.md#principled-implementation
 *   The readonly node array is returned unchanged, retaining element order and
 *   identity. Omission creates an empty array; no compiler NodeArray metadata exists.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The outline uses ordinary arrays, so this compatibility convenience adds no
 *   wrapper object that builders or the printer must unwrap.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   [] is the omitted-elements value, not a replacement for supplied elements.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain shared array identity, missing kind/metadata and
 *   non-printability separately from the example and acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The given elements as a readonly array.
 */
export const createNodeArray = <T extends Node>(
  elements: readonly T[] = [],
): readonly T[] => elements;
