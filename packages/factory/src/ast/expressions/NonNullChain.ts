import type { Expression } from "./Expression";

/**
 * A non-null assertion within an optional chain.
 *
 * Built by {@link factory.createNonNullChain}.
 *
 * The assertion remains part of an optional-chain outline. It prints `!` but
 * performs no runtime null check and does not prove the value is non-null.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The expression and chain-specific kind preserve an assertion within chain continuation; the exclamation mark records a type assertion rather than a runtime guarantee.
 * @evidence contracts/common.md#clear-and-simple-design The node wraps one operand and leaves earlier chain links in that operand, with no duplicated nullability state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Non-null syntax is explicit input rather than a fabricated runtime check compensating for an unsafe operand.
 * @evidence contracts/common.md#meaningful-documentation Native prose states chain participation and the absence of a runtime guarantee; the operand and tag block remain separated under documentation guidance.
 */
export interface NonNullChain {
  /** Discriminant tag; always `"NonNullChain"`. */
  kind: "NonNullChain";

  /** Operand that remains within the optional-chain outline. */
  expression: Expression;
}
