import type { Expression, ReturnStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ReturnStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ReturnStatement}.
 */
export const createReturnStatement = (
  expression?: Expression,
): ReturnStatement => make("ReturnStatement", { expression });
