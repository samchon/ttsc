import type { Decorator, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Decorator}: an `@expression` attached to a declaration.
 *
 * The `expression` is the decorator body, commonly an identifier or a call
 * expression. The printer prefixes it with `@` and emits the expression as
 * given; it does not add the surrounding declaration.
 *
 * With `expression` of an identifier named `deco`, this prints:
 *
 * ```ts
 * @deco
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link Decorator}.
 */
export const createDecorator = (expression: Expression): Decorator =>
  make("Decorator", { expression });
