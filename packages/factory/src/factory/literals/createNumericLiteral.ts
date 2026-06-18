import type { NumericLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NumericLiteral}: a numeric literal expression.
 *
 * The `value` accepts either a number or a string. It is coerced to its string
 * form and stored verbatim, so the printer emits exactly that text. Passing a
 * string lets you preserve a specific spelling such as `0xff` or `1_000`.
 *
 * With `value` of `42`, this prints:
 *
 * ```ts
 * 42;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param value The literal value.
 * @returns The created {@link NumericLiteral}.
 */
export const createNumericLiteral = (value: string | number): NumericLiteral =>
  make("NumericLiteral", { text: String(value) });
