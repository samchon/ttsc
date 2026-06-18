import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc type expression — a type wrapped in braces, e.g. `{number}`.
 *
 * Built by {@link factory.createJSDocTypeExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypeExpression {
  /** Discriminant tag; always `"JSDocTypeExpression"`. */
  kind: "JSDocTypeExpression";

  /** The wrapped type. */
  type: TypeNode;
}
