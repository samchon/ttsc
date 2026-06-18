import type { PrivateIdentifier } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link PrivateIdentifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link PrivateIdentifier}.
 */
export const createPrivateIdentifier = (text: string): PrivateIdentifier =>
  make("PrivateIdentifier", { text: text.startsWith("#") ? text : `#${text}` });
