import type { NoSubstitutionTemplateLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NoSubstitutionTemplateLiteral}: a backtick template string
 * with no `${...}` substitutions.
 *
 * The `text` is the literal content between the backticks. Because there are no
 * placeholders, the whole literal is a single span and the printer wraps the
 * content in backticks unchanged.
 *
 * With `text` of `hello`, this prints:
 *
 * ```ts
 * `hello`;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createNoSubstitutionTemplateLiteral = (
  text: string,
): NoSubstitutionTemplateLiteral =>
  make("NoSubstitutionTemplateLiteral", { text });
