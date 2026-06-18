import type { OmittedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link OmittedExpression}: an elided element, the hole left by a
 * missing entry in an array literal or binding pattern.
 *
 * The node carries no operand. The printer emits nothing for it; the
 * surrounding list still prints its comma separator, which is what produces the
 * visible gap.
 *
 * Placed before `a` in an array literal, the printer emits:
 *
 * ```ts
 * [, a];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link OmittedExpression}.
 */
export const createOmittedExpression = (): OmittedExpression =>
  make("OmittedExpression", {});
