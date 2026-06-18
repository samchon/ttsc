import type { Expression } from "./Expression";

/**
 * A non-null assertion within an optional chain.
 *
 * Built by {@link factory.createNonNullChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NonNullChain {
  /** Discriminant tag; always `"NonNullChain"`. */
  kind: "NonNullChain";

  /** Expression. */
  expression: Expression;
}
