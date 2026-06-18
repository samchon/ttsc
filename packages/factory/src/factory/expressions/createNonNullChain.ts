import type { Expression, NonNullChain } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NonNullChain}: a non-null assertion `!` that participates in
 * an optional chain.
 *
 * This is the chain-aware variant of {@link createNonNullExpression}. It marks
 * `expression` as non-null inside an optional chain so the chain context is
 * preserved. The printed form is the same single `!` suffix.
 *
 * With `expression` of `a`, the printer emits:
 *
 * ```ts
 * a!;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to assert as non-null.
 * @returns The created {@link NonNullChain}.
 */
export const createNonNullChain = (expression: Expression): NonNullChain =>
  make("NonNullChain", { expression });
