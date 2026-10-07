import type { TypeNode } from "./TypeNode";

/**
 * A conditional type, e.g. `T extends U ? X : Y`.
 *
 * Built by {@link factory.createConditionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Four TypeNode operands distinguish the tested type, constraint and two result branches; the shape records syntax rather than evaluating the relation.
 * @evidence contracts/common.md#clear-and-simple-design Named operands expose conditional direction without encoding positional tuples or evaluator state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Branch types come from callers, with no fixture-specific conditional outcomes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates conditional syntax and labels each operand's role; separated comments follow the documentation skill.
 */
export interface ConditionalTypeNode {
  /** Discriminant tag; always `"ConditionalTypeNode"`. */
  kind: "ConditionalTypeNode";

  /** Type tested on the left of extends. */
  checkType: TypeNode;

  /** Constraint on the right of extends. */
  extendsType: TypeNode;

  /** Result type after ? when the constraint holds. */
  trueType: TypeNode;

  /** Result type after : when the constraint does not hold. */
  falseType: TypeNode;
}
