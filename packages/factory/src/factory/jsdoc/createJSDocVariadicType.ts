import type { JSDocVariadicType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocVariadicType}: a JSDoc `...`-marked variadic type.
 *
 * The `type` is the wrapped element type. The printer prepends a `...` marker
 * before it.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * ...number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocVariadicType}.
 */
export const createJSDocVariadicType = (type: TypeNode): JSDocVariadicType =>
  make("JSDocVariadicType", {
    type,
  });
