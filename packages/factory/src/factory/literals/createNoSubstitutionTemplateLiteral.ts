import type { NoSubstitutionTemplateLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NoSubstitutionTemplateLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createNoSubstitutionTemplateLiteral = (
  text: string,
): NoSubstitutionTemplateLiteral =>
  make("NoSubstitutionTemplateLiteral", { text });
