import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * An angle-bracket type assertion, e.g. `<T>value`.
 *
 * Built by {@link factory.createTypeAssertion}.
 *
 * The node records an asserted type without assignability checking or runtime
 * conversion. Angle-bracket assertions require a context that permits this
 * syntax, rather than a JSX parsing context.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Type and operand retain the angle-bracket assertion form distinctly from AsExpression; the caller must supply a grammar context allowing that form and a meaningful assertion.
 * @evidence contracts/common.md#clear-and-simple-design Two direct constituents express the assertion without type-checker state or a duplicate runtime conversion node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The asserted type remains supplied syntax instead of coercing the value or manufacturing assignability success.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the runtime, checking and JSX-context limits; member roles and tags use separate blocks following documentation guidance.
 */
export interface TypeAssertion {
  /** Discriminant tag; always `"TypeAssertion"`. */
  kind: "TypeAssertion";

  /** Asserted type printed between angle brackets. */
  type: TypeNode;

  /** Operand following the asserted type. */
  expression: Expression;
}
