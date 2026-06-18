import type { JSDocNamepathType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNamepathType}: a JSDoc namepath type.
 *
 * The `type` is the wrapped type. This node carries no marker of its own, so
 * the printer emits the wrapped type alone with no surrounding prefix or
 * suffix.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * number;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocNamepathType}.
 */
export const createJSDocNamepathType = (type: TypeNode): JSDocNamepathType =>
  make("JSDocNamepathType", {
    type,
  });
