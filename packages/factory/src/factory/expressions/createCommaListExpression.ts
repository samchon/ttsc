import type { CommaListExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CommaListExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created node.
 */
export const createCommaListExpression = (
  elements: readonly Expression[],
): CommaListExpression => make("CommaListExpression", { elements });
