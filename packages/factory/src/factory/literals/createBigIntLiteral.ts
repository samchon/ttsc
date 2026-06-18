import type { BigIntLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link BigIntLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param value The literal value.
 * @returns The created {@link BigIntLiteral}.
 */
export const createBigIntLiteral = (value: string): BigIntLiteral =>
  make("BigIntLiteral", { text: value.endsWith("n") ? value : `${value}n` });
