import type { Expression, SpreadAssignment } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadAssignment}: a `...expression` member that spreads one
 * object's properties into an object literal.
 *
 * `expression` is the source object. The printer prefixes it with `...` and no
 * separating space.
 *
 * With `expression` of `a` inside an object literal, the printer emits:
 *
 * ```ts
 * { ...a }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression to spread.
 * @returns The created {@link SpreadAssignment}.
 */
export const createSpreadAssignment = (
  expression: Expression,
): SpreadAssignment => make("SpreadAssignment", { expression });
