import type { Expression } from "./Expression";

/**
 * A non-null assertion, e.g. `value!`.
 *
 * Built by {@link factory.createNonNullExpression}.
 *
 * This records a type assertion without checking or changing the runtime value.
 * Use NonNullChain when the assertion continues an optional chain.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation One operand and an ordinary assertion kind distinguish value! from a chain-preserving assertion; no runtime non-null guarantee is encoded.
 * @evidence contracts/common.md#clear-and-simple-design The operand remains a reusable expression subtree rather than adding a second representation for asserted values.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The assertion is supplied syntax rather than a default value or patched null-check result.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the chain distinction and runtime limitation, separated from member comments and acknowledgment tags according to documentation guidance.
 */
export interface NonNullExpression {
  /** Discriminant tag; always `"NonNullExpression"`. */
  kind: "NonNullExpression";

  /** The expression. */
  expression: Expression;
}
