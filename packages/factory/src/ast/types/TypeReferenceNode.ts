import type { EntityName } from "../names/EntityName";
import type { TypeNode } from "./TypeNode";

/**
 * A reference to a named type, e.g. `Array<T>`.
 *
 * Built by {@link factory.createTypeReferenceNode}.
 *
 * @evidence contracts/common.md#principled-implementation EntityName and optional ordered type arguments preserve named generic reference spelling without resolving names or checking generic arity.
 * @evidence contracts/common.md#clear-and-simple-design Name qualification belongs to EntityName; the reference only attaches generic arguments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Referenced names and arguments are supplied syntax, with no consumer-specific type mapping.
 * @evidence contracts/common.md#meaningful-documentation JSDoc gives Array<T> and describes absent generic arguments; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeReferenceNode {
  /** Discriminant tag; always `"TypeReferenceNode"`. */
  kind: "TypeReferenceNode";

  /** The referenced type name. */
  typeName: EntityName;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];
}
