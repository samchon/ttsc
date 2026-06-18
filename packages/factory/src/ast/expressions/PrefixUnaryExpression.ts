import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A prefix unary expression, e.g. `!flag` or `-n`.
 *
 * Built by {@link factory.createPrefixUnaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PrefixUnaryExpression {
  /** Discriminant tag; always `"PrefixUnaryExpression"`. */
  kind: "PrefixUnaryExpression";

  /** The operator token. */
  operator: SyntaxKind;

  /** The operand. */
  operand: Expression;
}
