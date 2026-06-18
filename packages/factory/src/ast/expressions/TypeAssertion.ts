import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * An angle-bracket type assertion, e.g. `<T>value`.
 *
 * Built by {@link factory.createTypeAssertion}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeAssertion {
  /** Discriminant tag; always `"TypeAssertion"`. */
  kind: "TypeAssertion";

  /** Type. */
  type: TypeNode;

  /** Expression. */
  expression: Expression;
}
