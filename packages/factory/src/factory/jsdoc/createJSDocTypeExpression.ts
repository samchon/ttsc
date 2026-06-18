import type { JSDocTypeExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocTypeExpression}: a brace-wrapped JSDoc type.
 *
 * The `type` is the wrapped type. The printer surrounds it with curly braces,
 * producing the `{Type}` form that JSDoc tags use to carry their type.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * {number}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocTypeExpression}.
 */
export const createJSDocTypeExpression = (
  type: TypeNode,
): JSDocTypeExpression =>
  make("JSDocTypeExpression", {
    type,
  });
