import type { SemicolonClassElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SemicolonClassElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link SemicolonClassElement}.
 */
export const createSemicolonClassElement = (): SemicolonClassElement =>
  make("SemicolonClassElement", {});
