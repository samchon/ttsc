/**
 * The JSDoc unknown type `?`.
 *
 * Built by {@link factory.createJSDocUnknownType}.
 *
 * This is the bare unknown marker, not the nullable marker on another type.
 *
 * @evidence contracts/common.md#principled-implementation A childless discriminated node distinguishes the bare question mark from JSDocNullableType, whose question mark modifies a child type.
 * @evidence contracts/common.md#clear-and-simple-design The kind alone represents the unknown form; there is no unused operand or nullable-placement state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The constant kind records a grammatical distinction rather than substituting a known output for caller input.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains the easily confused unknown and nullable forms, using a separate paragraph before tags under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocUnknownType {
  /** Discriminant tag; always `"JSDocUnknownType"`. */
  kind: "JSDocUnknownType";
}
