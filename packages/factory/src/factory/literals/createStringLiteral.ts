import type { StringLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link StringLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @param isSingleQuote When `true`, use single quotes instead of double.
 * @returns The created {@link StringLiteral}.
 */
export const createStringLiteral = (
  text: string,
  isSingleQuote?: boolean,
): StringLiteral => make("StringLiteral", { text, singleQuote: isSingleQuote });
