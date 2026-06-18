import type { RegularExpressionLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link RegularExpressionLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createRegularExpressionLiteral = (
  text: string,
): RegularExpressionLiteral => make("RegularExpressionLiteral", { text });
