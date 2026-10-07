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
 * No runtime null check is introduced by this syntax construction.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to assert as non-null.
 * @returns The created {@link NonNullChain}.
 * @evidence contracts/common.md#principled-implementation NonNullChain retains the operand's chain context while recording assertion syntax, without establishing a runtime non-null guarantee.
 * @evidence contracts/common.md#clear-and-simple-design The chain-specific kind and one operand suffice; preceding links remain in the operand and printer grouping stays centralized.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit assertion does not inject a default value or patch null handling for known consumers.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the chain-aware form and absence of runtime checking, with expression example and tags separated under documentation guidance.
 */
export const createNonNullChain = (expression: Expression): NonNullChain =>
  make("NonNullChain", { expression });
