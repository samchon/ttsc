import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "./TypeNode";

/**
 * An index signature, e.g. `[key: string]: number`.
 *
 * Built by {@link factory.createIndexSignature}.
 *
 * @evidence contracts/common.md#principled-implementation Parameters and required value annotation preserve index-signature syntax; the broad parameter/modifier shapes do not enforce TypeScript's signature restrictions.
 * @evidence contracts/common.md#clear-and-simple-design Signature fields separate leading modifiers, bracket parameters and value type with existing shared nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No key names or value types are substituted for particular consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc gives an index-signature example and explains bracket parameters and indexed values; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IndexSignatureDeclaration {
  /** Discriminant tag; always `"IndexSignature"`. */
  kind: "IndexSignature";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** Parameters printed inside the index brackets. */
  parameters: readonly ParameterDeclaration[];

  /** Value type returned for an indexed key. */
  type: TypeNode;
}
