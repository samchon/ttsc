import type { JSDocUnknownType } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocUnknownType}: the JSDoc `?` unknown type.
 *
 * This node takes no inputs. It represents the unknown-type marker written as a
 * bare question mark in a JSDoc type expression.
 *
 * The printer emits:
 *
 * ```ts
 * ?
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JSDocUnknownType}.
 */
export const createJSDocUnknownType = (): JSDocUnknownType =>
  make("JSDocUnknownType", {});
