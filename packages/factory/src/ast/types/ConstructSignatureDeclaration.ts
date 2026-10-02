import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A construct signature member, e.g. `new (a: A): T`.
 *
 * Built by {@link factory.createConstructSignature}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered parameters plus optional generic and result clauses express a construct-signature member; semantic constructability is not checked by the representation.
 * @evidence contracts/common.md#clear-and-simple-design The member stores only its call shape and delegates parameter syntax to ParameterDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The construct discriminant represents new-call syntax, not an output exception for a caller.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates a construct member and describes omission of clauses; separated prose follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructSignatureDeclaration {
  /** Discriminant tag; always `"ConstructSignature"`. */
  kind: "ConstructSignature";

  /** Generic parameters in declaration order, if present. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Constructor parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Constructed result annotation; omitted when none is supplied. */
  type?: TypeNode;
}
