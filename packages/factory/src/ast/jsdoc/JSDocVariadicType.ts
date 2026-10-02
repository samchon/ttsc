import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc variadic type, e.g. `...Type`.
 *
 * Built by {@link factory.createJSDocVariadicType}.
 *
 * The child supplies the element type printed after `...`. This annotation
 * does not validate a function's rest-parameter placement.
 *
 * @evidence contracts/common.md#principled-implementation The variadic kind and required element type represent the ellipsis annotation while leaving contextual parameter validity outside the printable node.
 * @evidence contracts/common.md#clear-and-simple-design A single child provides the type payload, and the kind determines the prefix without duplicating parameter-list state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The ellipsis denotes the represented syntax, with no known-argument special case or patched function signature.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies the element role and contextual-validation boundary, separating prose from tags and documented members under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocVariadicType {
  /** Discriminant tag; always `"JSDocVariadicType"`. */
  kind: "JSDocVariadicType";

  /** Element type emitted after the variadic marker. */
  type: TypeNode;
}
