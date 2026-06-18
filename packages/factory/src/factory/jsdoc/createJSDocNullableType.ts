import type { JSDocNullableType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNullableType}: a JSDoc `?`-marked nullable type.
 *
 * The `type` is the wrapped type. The `postfix` flag controls placement of the
 * `?` marker: when `true` it prints after the type, when `false` it prints
 * before.
 *
 * With a `number` type and `postfix` of `true`, the printer emits:
 *
 * ```ts
 * number?
 * ```
 *
 * The same type with `postfix` of `false` instead emits:
 *
 * ```ts
 * ?number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @param postfix Whether the `?` is written after the type.
 * @returns The created {@link JSDocNullableType}.
 */
export const createJSDocNullableType = (
  type: TypeNode,
  postfix: boolean = false,
): JSDocNullableType =>
  make("JSDocNullableType", {
    type,
    postfix,
  });
