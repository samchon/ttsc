import type { TemplateHead } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateHead}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param rawText The rawText.
 * @returns The created node.
 */
export const createTemplateHead = (
  text: string,
  rawText?: string,
): TemplateHead => make("TemplateHead", { text, rawText });
