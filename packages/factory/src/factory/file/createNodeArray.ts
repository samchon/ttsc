import type { Node } from "../../ast";

/**
 * Create the node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created node.
 */
export const createNodeArray = <T extends Node>(
  elements: readonly T[] = [],
): readonly T[] => elements;
