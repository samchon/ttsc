import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A binary expression, e.g. `a + b` or `a === b`.
 *
 * Built by {@link factory.createBinaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BinaryExpression {
  /** Discriminant tag; always `"BinaryExpression"`. */
  kind: "BinaryExpression";

  /** The left-hand operand. */
  left: Expression;

  /** The operator token. */
  operator: SyntaxKind;

  /** The right-hand operand. */
  right: Expression;
}
