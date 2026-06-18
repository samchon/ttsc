import type { TemplateMiddle } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateMiddle}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createTemplateMiddle = (text: string): TemplateMiddle =>
  make("TemplateMiddle", { text });
