import type { JSDocAllType } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocAllType}: the JSDoc `*` wildcard type.
 *
 * This node takes no inputs. It represents the "any" wildcard written as a bare
 * asterisk in a JSDoc type expression.
 *
 * The printer emits:
 *
 * ```ts
 * *
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JSDocAllType}.
 */
export const createJSDocAllType = (): JSDocAllType => make("JSDocAllType", {});
