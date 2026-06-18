import type { Identifier } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Identifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link Identifier}.
 */
export const createIdentifier = (text: string): Identifier =>
  make("Identifier", { text });
