import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc optional type, e.g. `Type=`.
 *
 * Built by {@link factory.createJSDocOptionalType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOptionalType {
  /** Discriminant tag; always `"JSDocOptionalType"`. */
  kind: "JSDocOptionalType";

  /** The wrapped type. */
  type: TypeNode;
}
