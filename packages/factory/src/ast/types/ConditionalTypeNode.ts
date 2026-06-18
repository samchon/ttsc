import type { TypeNode } from "./TypeNode";

/**
 * A conditional type, e.g. `T extends U ? X : Y`.
 *
 * Built by {@link factory.createConditionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConditionalTypeNode {
  /** Discriminant tag; always `"ConditionalTypeNode"`. */
  kind: "ConditionalTypeNode";

  /** CheckType. */
  checkType: TypeNode;

  /** ExtendsType. */
  extendsType: TypeNode;

  /** TrueType. */
  trueType: TypeNode;

  /** FalseType. */
  falseType: TypeNode;
}
