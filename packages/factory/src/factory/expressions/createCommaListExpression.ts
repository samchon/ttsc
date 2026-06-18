import type { CommaListExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CommaListExpression}: a synthetic list of expressions joined
 * by commas, used where several expressions are emitted in sequence.
 *
 * Unlike a chain of comma {@link BinaryExpression} nodes, this is a flat list.
 * The printer separates the elements with a comma and a space.
 *
 * Given elements `a`, `b`, `c`, the printer emits:
 *
 * ```ts
 * (a, b, c);
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The element expressions.
 * @returns The created {@link CommaListExpression}.
 */
export const createCommaListExpression = (
  elements: readonly Expression[],
): CommaListExpression => make("CommaListExpression", { elements });
