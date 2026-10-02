import type { TypeNode } from "./TypeNode";

/**
 * An indexed access type, e.g. `T[K]`.
 *
 * Built by {@link factory.createIndexedAccessTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation Separate object and index TypeNodes preserve T[K] operand roles without asserting that K is a valid key.
 * @evidence contracts/common.md#clear-and-simple-design Two named operands expose indexing direction while child nodes own their syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation contains no hardcoded key or consumer-specific lookup answer.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates indexed access and labels both type operands; separated comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IndexedAccessTypeNode {
  /** Discriminant tag; always `"IndexedAccessTypeNode"`. */
  kind: "IndexedAccessTypeNode";

  /** The object type. */
  objectType: TypeNode;

  /** The index type. */
  indexType: TypeNode;
}
