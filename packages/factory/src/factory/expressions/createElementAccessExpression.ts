import type { ElementAccessExpression, Expression } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create an {@link ElementAccessExpression}: a `object[key]` bracket access.
 *
 * A numeric `index` is wrapped with {@link createNumericLiteral}; any other
 * expression is used as the key directly. The printer wraps the key in square
 * brackets, so a string key prints quoted (for example `obj["key"]`).
 *
 * Given object `obj` and index `0`, the printer emits:
 *
 * ```ts
 * obj[0];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression.
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
