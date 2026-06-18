import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A postfix unary expression, e.g. `i++`.
 *
 * Built by {@link factory.createPostfixUnaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PostfixUnaryExpression {
  /** Discriminant tag; always `"PostfixUnaryExpression"`. */
  kind: "PostfixUnaryExpression";

  /** The operand. */
  operand: Expression;

  /** The operator token. */
  operator: SyntaxKind;
}
