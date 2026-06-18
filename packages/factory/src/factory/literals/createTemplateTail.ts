import type { TemplateTail } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateTail}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createTemplateTail = (text: string): TemplateTail =>
  make("TemplateTail", { text });
