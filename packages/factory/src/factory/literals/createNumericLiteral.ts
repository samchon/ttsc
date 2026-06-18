import type { NumericLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NumericLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param value The literal value.
 * @returns The created {@link NumericLiteral}.
 */
export const createNumericLiteral = (value: string | number): NumericLiteral =>
  make("NumericLiteral", { text: String(value) });
