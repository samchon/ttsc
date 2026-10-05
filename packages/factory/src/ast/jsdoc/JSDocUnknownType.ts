/**
 * The JSDoc unknown type `?`.
 *
 * Built by {@link factory.createJSDocUnknownType}.
 *
 * This is the bare unknown marker, not the nullable marker on another type.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A childless discriminated node distinguishes the bare question mark from JSDocNullableType, whose question mark modifies a child type.
 * @evidence contracts/common.md#clear-and-simple-design The kind alone represents the unknown form; there is no unused operand or nullable-placement state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The constant kind records a grammatical distinction rather than substituting a known output for caller input.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains the easily confused unknown and nullable forms, using a separate paragraph before tags under the documentation guidance.
 */
export interface JSDocUnknownType {
  /** Discriminant tag; always `"JSDocUnknownType"`. */
  kind: "JSDocUnknownType";
}
