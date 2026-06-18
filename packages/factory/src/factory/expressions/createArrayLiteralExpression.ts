import type { ArrayLiteralExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ArrayLiteralExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ArrayLiteralExpression}.
 */
export const createArrayLiteralExpression = (
  elements: readonly Expression[] = [],
  multiLine?: boolean,
): ArrayLiteralExpression =>
  make("ArrayLiteralExpression", { elements, multiLine });
