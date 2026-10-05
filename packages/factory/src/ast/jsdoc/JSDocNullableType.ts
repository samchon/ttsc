import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc nullable type, e.g. `?Type` (prefix) or `Type?` (postfix).
 *
 * Built by {@link factory.createJSDocNullableType}.
 *
 * A child is required, unlike the bare unknown marker `?`. Prefix or postfix
 * placement changes notation; this node does not validate the child's values.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A child-bearing nullable form and explicit placement distinguish question-mark modification from the childless JSDocUnknownType without claiming semantic type checking.
 * @evidence contracts/common.md#clear-and-simple-design The child and one placement flag capture both notations with no alternate representation or inferred nullability state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Placement is caller-supplied syntax data, not a branch recognizing a particular type name or a patched nullability analysis.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the unknown-marker distinction and lack of value validation; property and paragraph separation follows the documentation guidance.
 */
export interface JSDocNullableType {
  /** Discriminant tag; always `"JSDocNullableType"`. */
  kind: "JSDocNullableType";

  /** The wrapped type. */
  type: TypeNode;

  /** Whether the `?` is written after the type (postfix) rather than before. */
  postfix: boolean;
}
