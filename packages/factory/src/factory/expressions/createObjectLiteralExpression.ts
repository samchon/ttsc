import type { ObjectLiteralElement, ObjectLiteralExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ObjectLiteralExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param properties The properties.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ObjectLiteralExpression}.
 */
export const createObjectLiteralExpression = (
  properties: readonly ObjectLiteralElement[] = [],
  multiLine?: boolean,
): ObjectLiteralExpression =>
  make("ObjectLiteralExpression", { properties, multiLine });
