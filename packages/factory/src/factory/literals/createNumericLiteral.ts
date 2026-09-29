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
 * 42
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   String(value) records numeric lexical text without changing caller string
 *   spellings such as hexadecimal notation. Valid literal spelling is required.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Conversion and node construction are the complete responsibility here;
 *   the printer reads the resulting text rather than repeating coercion.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The caller supplies the value; no special numbers or consumers select it.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc distinguishes number coercion from preserved string spelling
 *   and supplies an example, separated from tags under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param value The literal value.
 * @returns The created {@link NumericLiteral}.
 */
export const createNumericLiteral = (value: string | number): NumericLiteral =>
  make("NumericLiteral", { text: String(value) });
