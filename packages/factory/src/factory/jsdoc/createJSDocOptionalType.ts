import type { JSDocOptionalType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocOptionalType}: a JSDoc `=`-marked optional type.
 *
 * The `type` is the wrapped type. The printer appends an `=` marker after it.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * number=
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocOptionalType}.
 */
export const createJSDocOptionalType = (type: TypeNode): JSDocOptionalType =>
  make("JSDocOptionalType", {
    type,
  });
