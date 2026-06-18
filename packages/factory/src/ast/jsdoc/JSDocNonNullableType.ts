import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc non-nullable type, e.g. `!Type` (prefix) or `Type!` (postfix).
 *
 * Built by {@link factory.createJSDocNonNullableType}.
 *
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
