import type { Expression, SpreadElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadElement}: a `...expression` element that spreads an
 * iterable into an array literal or argument list.
 *
 * `expression` is the source iterable. The printer prefixes it with `...` and
 * no separating space.
 *
 * With `expression` of `a` inside an array literal, the printer emits:
 *
 * ```ts
 * [...a];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The iterable expression to spread.
 * @returns The created {@link SpreadElement}.
 */
export const createSpreadElement = (expression: Expression): SpreadElement =>
  make("SpreadElement", { expression });
