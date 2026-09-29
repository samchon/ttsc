import type { ElementAccessChain, Expression, Token } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create an {@link ElementAccessChain}: a bracket access that participates in an
 * optional chain.
 *
 * The `questionDotToken` is the `?.` token printed before the brackets. A
 * numeric `index` is wrapped with {@link createNumericLiteral}; any other
 * expression is used as the key directly. The printer wraps the key in square
 * brackets.
 *
 * Given object `obj`, an optional `?.` token and index `0`, the printer emits:
 *
 * ```ts
 * obj?.[0]
 * ```
 *
 * Without a marker, this link prints ordinary brackets while retaining chain
 * continuation. A numeric index must have a valid literal spelling.
 *
 * @evidence contracts/common.md#principled-implementation Numeric input normalizes to a NumericLiteral while expression keys remain unchanged; chain kind and marker preserve this-link optionality independently of preceding links.
 * @evidence contracts/common.md#clear-and-simple-design Shared numeric construction and one make call adapt the key without flattening the receiver's chain.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Numeric wrapping follows the accepted input representation rather than guessing a property key or patching receiver access.
 * @evidence contracts/common.md#meaningful-documentation Native prose states numeric normalization and marker absence, with ordered parameter roles, direct expression example and separate tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression.
 * @param questionDotToken The `?.` token, if this link is optional.
 * @param index The index or key.
 * @returns The created {@link ElementAccessChain}.
 */
export const createElementAccessChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  index: number | Expression,
): ElementAccessChain =>
  make("ElementAccessChain", {
    expression,
    questionDotToken,
    argumentExpression:
      typeof index === "number" ? createNumericLiteral(index) : index,
  });
