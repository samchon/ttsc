import type { Expression, SpreadAssignment } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SpreadAssignment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link SpreadAssignment}.
 */
export const createSpreadAssignment = (
  expression: Expression,
): SpreadAssignment => make("SpreadAssignment", { expression });
