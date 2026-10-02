import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";

/**
 * A property member of an interface or type literal.
 *
 * Built by {@link factory.createPropertySignature}.
 *
 * @evidence contracts/common.md#principled-implementation Name, optional marker and annotation preserve a property signature; the broad shared PropertyName does not validate interface-specific name restrictions.
 * @evidence contracts/common.md#clear-and-simple-design Each property clause has one field using existing modifier, name and type representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and annotations are caller data, without hardcoded consumer properties.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies type-member use and annotation omission; separated member comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertySignature {
  /** Discriminant tag; always `"PropertySignature"`. */
  kind: "PropertySignature";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** Property annotation; omitted when none is supplied. */
  type?: TypeNode;
}
