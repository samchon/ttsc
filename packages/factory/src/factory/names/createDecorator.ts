import type { Decorator, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Decorator}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link Decorator}.
 */
export const createDecorator = (expression: Expression): Decorator =>
  make("Decorator", { expression });
