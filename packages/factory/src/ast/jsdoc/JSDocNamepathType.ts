import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc namepath type, e.g. `module:foo.Bar`.
 *
 * Built by {@link factory.createJSDocNamepathType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNamepathType {
  /** Discriminant tag; always `"JSDocNamepathType"`. */
  kind: "JSDocNamepathType";

  /** The wrapped type. */
  type: TypeNode;
}
