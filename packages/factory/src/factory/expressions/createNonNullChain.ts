import type { Expression, NonNullChain } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NonNullChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created node.
 */
export const createNonNullChain = (expression: Expression): NonNullChain =>
  make("NonNullChain", { expression });
