import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A prefix unary expression, e.g. `!flag` or `-n`.
 *
 * Built by {@link factory.createPrefixUnaryExpression}.
 *
 * Supply a valid prefix operator and operand. SyntaxKind also includes tokens
 * that are not unary operators; update operators additionally require a legal
 * assignment target. This shape validates neither condition.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Lexical operator and operand retain prefix order; broad token and expression fields require caller-owned operator legality and update-target validity.
 * @evidence contracts/common.md#clear-and-simple-design The pair captures the prefix form while the printer owns precedence and lexical separation between adjacent operator tokens.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit operator is syntax data rather than a replaced foreign method or precomputed result for a known operand.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains token breadth and update-target requirements; separate member comments and tags follow documentation guidance.
 */
export interface PrefixUnaryExpression {
  /** Discriminant tag; always `"PrefixUnaryExpression"`. */
  kind: "PrefixUnaryExpression";

  /** The operator token. */
  operator: SyntaxKind;

  /** The operand. */
  operand: Expression;
}
