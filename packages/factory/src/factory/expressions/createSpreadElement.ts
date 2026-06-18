import type { Expression, SpreadElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link SpreadElement}.
 */
export const createSpreadElement = (expression: Expression): SpreadElement =>
  make("SpreadElement", { expression });
