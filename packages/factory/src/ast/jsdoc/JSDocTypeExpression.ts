import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc type expression: a type wrapped in braces, e.g. `{number}`.
 *
 * Built by {@link factory.createJSDocTypeExpression}.
 *
 * The wrapper adds braces around the child's printed form. It does not parse
 * JSDoc text or establish that the child is valid in a particular tag.
 *
 * @evidence contracts/common.md#principled-implementation A required TypeNode supplies the inner representation and the wrapper kind supplies braces, preserving the distinction between a type and a tag's braced type payload.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper has one child and no stored brace text, parser state or duplicated type representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Braces are the supported wrapper syntax rather than a fixture-specific output, and the child is not replaced with a guessed type.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains brace insertion and the absence of parsing or contextual validation; its paragraph and member spacing follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypeExpression {
  /** Discriminant tag; always `"JSDocTypeExpression"`. */
  kind: "JSDocTypeExpression";

  /** The wrapped type. */
  type: TypeNode;
}
