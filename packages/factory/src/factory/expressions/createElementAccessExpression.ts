import type { ElementAccessExpression, Expression } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create a {@link ElementAccessExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param index The index or key.
 * @returns The created {@link ElementAccessExpression}.
 */
export const createElementAccessExpression = (
  expression: Expression,
  index: number | Expression,
): ElementAccessExpression =>
  make("ElementAccessExpression", {
    expression,
    argumentExpression:
      typeof index === "number" ? createNumericLiteral(index) : index,
  });
