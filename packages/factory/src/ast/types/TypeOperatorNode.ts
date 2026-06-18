import type { SyntaxKind } from "../../syntax";
import type { TypeNode } from "./TypeNode";

/**
 * A type operator, e.g. `keyof T` or `readonly T[]`.
 *
 * Built by {@link factory.createTypeOperatorNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeOperatorNode {
  /** Discriminant tag; always `"TypeOperatorNode"`. */
  kind: "TypeOperatorNode";

  /** The operator token. */
  operator: SyntaxKind;

  /** The type. */
  type: TypeNode;
}
