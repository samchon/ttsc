import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A call signature member, e.g. `(a: A): T`.
 *
 * Built by {@link factory.createCallSignature}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered parameters and optional generics/return annotation express a call signature; omitted annotations remain absent syntax, not inferred types stored here.
 * @evidence contracts/common.md#clear-and-simple-design The signature owns parameter order and annotation presence; ParameterDeclaration owns each parameter's syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional fields model caller syntax choices without hardcoded callable names or test behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc shows signature spelling; member prose explains omission and ordering, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CallSignatureDeclaration {
  /** Discriminant tag; always `"CallSignature"`. */
  kind: "CallSignature";

  /** Generic parameters in declaration order; omitted when no generic clause exists. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Parameters in call order. */
  parameters: readonly ParameterDeclaration[];

  /** Return annotation; omitted when the signature supplies none. */
  type?: TypeNode;
}
