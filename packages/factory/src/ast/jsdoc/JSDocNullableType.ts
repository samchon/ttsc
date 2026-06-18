import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc nullable type, e.g. `?Type` (prefix) or `Type?` (postfix).
 *
 * Built by {@link factory.createJSDocNullableType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNullableType {
  /** Discriminant tag; always `"JSDocNullableType"`. */
  kind: "JSDocNullableType";

  /** The wrapped type. */
  type: TypeNode;

  /** Whether the `?` is written after the type (postfix) rather than before. */
  postfix: boolean;
}
