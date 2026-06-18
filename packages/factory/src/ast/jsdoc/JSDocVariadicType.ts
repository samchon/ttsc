import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc variadic type, e.g. `...Type`.
 *
 * Built by {@link factory.createJSDocVariadicType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocVariadicType {
  /** Discriminant tag; always `"JSDocVariadicType"`. */
  kind: "JSDocVariadicType";

  /** The wrapped type. */
  type: TypeNode;
}
