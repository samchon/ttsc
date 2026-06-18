import type { ObjectLiteralElement, ObjectLiteralExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ObjectLiteralExpression}: a `{ ... }` object literal.
 *
 * `properties` are the members (assignments, shorthands, spreads, methods).
 * `multiLine` controls layout. When `true`, each property is printed on its own
 * line and a trailing comma is added; when falsy, the whole literal is printed
 * inline with a single space inside the braces.
 *
 * With a single property `a: 1` and `multiLine` of `true`, the printer emits:
 *
 * ```ts
 * {
 *   "a": 1
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param properties The object members.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ObjectLiteralExpression}.
 */
export const createObjectLiteralExpression = (
  properties: readonly ObjectLiteralElement[] = [],
  multiLine?: boolean,
): ObjectLiteralExpression =>
  make("ObjectLiteralExpression", { properties, multiLine });
