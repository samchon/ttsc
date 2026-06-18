import type { Expression, ThrowStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThrowStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ThrowStatement}.
 */
export const createThrowStatement = (expression: Expression): ThrowStatement =>
  make("ThrowStatement", { expression });
