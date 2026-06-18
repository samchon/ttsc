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
 */
export const createBigIntLiteral = (value: string): BigIntLiteral =>
  make("BigIntLiteral", { text: value.endsWith("n") ? value : `${value}n` });
