import type { Expression } from "../expressions/Expression";

/**
 * A `throw` statement.
 *
 * Built by {@link factory.createThrowStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A required Expression preserves the value after throw; the shape records syntax without raising an exception itself.
 * @evidence contracts/common.md#clear-and-simple-design One operand field carries the complete variable payload of a throw statement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Thrown values are supplied data, with no hidden retry or runtime error substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies throw syntax and its thrown operand; native spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThrowStatement {
  /** Discriminant tag; always `"ThrowStatement"`. */
  kind: "ThrowStatement";

  /** Value expression printed after throw. */
  expression: Expression;
}
