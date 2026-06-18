import type { Expression, VoidExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link VoidExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created node.
 */
export const createVoidExpression = (expression: Expression): VoidExpression =>
  make("VoidExpression", { expression });
