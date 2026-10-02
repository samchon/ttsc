import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc non-nullable type, e.g. `!Type` (prefix) or `Type!` (postfix).
 *
 * Built by {@link factory.createJSDocNonNullableType}.
 *
 * The flag controls marker placement only. This printable annotation does not
 * check the child's nullability or constrain runtime values.
 *
 * @evidence contracts/common.md#principled-implementation A required child and placement flag represent both supported exclamation-mark forms while distinguishing annotation spelling from semantic nullability enforcement.
 * @evidence contracts/common.md#clear-and-simple-design One boolean selects prefix or postfix notation without separate node families or redundant marker strings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exclamation mark is a grammatical constant, and its placement is explicit data rather than a special case for a known type or test input.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains placement and the lack of value validation, with separated property comments and paragraphs following the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNonNullableType {
  /** Discriminant tag; always `"JSDocNonNullableType"`. */
  kind: "JSDocNonNullableType";

  /** The wrapped type. */
  type: TypeNode;

  /** Whether the `!` is written after the type (postfix) rather than before. */
  postfix: boolean;
}
