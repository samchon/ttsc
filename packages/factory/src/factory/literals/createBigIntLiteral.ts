import type { BigIntLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link BigIntLiteral}: a `bigint` literal expression.
 *
 * The `value` is the digit text of the literal. The trailing `n` suffix is
 * appended automatically when it is missing, so both `123` and `123n` produce
 * the same node.
 *
 * With `value` of `123`, this prints:
 *
 * ```ts
 * 123n;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param value The literal value.
 * @returns The created {@link BigIntLiteral}.
 * @evidence contracts/common.md#principled-implementation
 *   BigIntLiteral stores lexical digit text; appending n only when absent
 *   matches its suffix representation. Callers must supply valid bigint digits.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One suffix normalization feeds the shared node constructor; lexical
 *   validation and printing are separate from this literal builder.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The n suffix is bigint syntax, not a consumer-selected literal value.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains suffix normalization and shows its printed form. Prose,
 *   example and acknowledgment tags use separate paragraphs.
 */
export const createBigIntLiteral = (value: string): BigIntLiteral =>
  make("BigIntLiteral", { text: value.endsWith("n") ? value : `${value}n` });
