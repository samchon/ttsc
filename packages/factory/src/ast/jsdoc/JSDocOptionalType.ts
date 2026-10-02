import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc optional type, e.g. `Type=`.
 *
 * Built by {@link factory.createJSDocOptionalType}.
 *
 * The child is followed by `=`. This annotates optionality; it does not make
 * the child field optional or provide a default value.
 *
 * @evidence contracts/common.md#principled-implementation A required child under an optional-type kind expresses the suffix annotation without confusing optional syntax with an absent AST operand or runtime default.
 * @evidence contracts/common.md#clear-and-simple-design The kind determines the equals suffix, so the node needs only its wrapped type and no redundant optionality flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The equals marker is syntax rather than a hardcoded default or a special treatment of an expected parameter value.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes annotation optionality from field absence and defaults, with a separate explanatory paragraph and member spacing under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOptionalType {
  /** Discriminant tag; always `"JSDocOptionalType"`. */
  kind: "JSDocOptionalType";

  /** The wrapped type. */
  type: TypeNode;
}
