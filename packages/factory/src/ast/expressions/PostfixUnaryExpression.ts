import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A postfix unary expression, e.g. `i++`.
 *
 * Built by {@link factory.createPostfixUnaryExpression}.
 *
 * Callers supply `++` or `--` and a legal update target. The broad SyntaxKind
 * and Expression fields do not enforce those restrictions.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Operand and lexical operator preserve postfix ordering; legal update operators and assignable targets are caller premises because the fields accept wider syntax categories.
 * @evidence contracts/common.md#clear-and-simple-design Two direct constituents capture the update form without storing evaluated values or a second target representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The node records supplied update syntax rather than computing or patching a foreign variable's value.
 * @evidence contracts/common.md#meaningful-documentation Native prose states operator and target constraints absent from typing; operand comments and acknowledgment tags remain distinct following documentation guidance.
 */
export interface PostfixUnaryExpression {
  /** Discriminant tag; always `"PostfixUnaryExpression"`. */
  kind: "PostfixUnaryExpression";

  /** The operand. */
  operand: Expression;

  /** The operator token. */
  operator: SyntaxKind;
}
